#!/usr/bin/env python3
"""Convert and review the supplied workbook without rewriting its Q/A text.

All 1,000 rows were read before making this review. Explicit shared concepts
include inverse relationships and easier crossed formulations. Ambiguities are
quarantined, not silently corrected. No Excel macros, formulas or code execute.
"""
import argparse
import csv
import hashlib
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

VERSION = 'excel-1000-20261010-v1'
POOLS = dict.fromkeys(['PAU', 'TECLA', 'TECLA_PAU', 'PAU_TECLA', 'TP'], 200)
PREFIX = {'P': 'PAU', 'T': 'TECLA', 'X': 'TECLA_PAU', 'Y': 'PAU_TECLA', 'C': 'TP'}

def identifier(ref):
    return f'NEW26-{PREFIX[ref[0]]}-{int(ref[1:]):03}'

# Reviewed relationships, not a blanket grouping by answer. Mercury the planet
# and mercury the metal, distinct countries/landmarks and numbered answers stay
# separate. Previously used canonical keys connect the old bank's history.
GROUPS = '''
new26:sql_group_by P1 X12
new26:sql_having P2 X13
new26:sql_join P3 X14
new26:sql_order_by P4 X11
new26:sql_update P11 X8
new26:sql_insert P12 X7
cs_acid_atomicity P17
cs_acid_isolation P19
new26:sql_avg P7 X16
new26:sql_sum P23 X17
new26:sql_where P25 X10
new26:stack P30 X1
new26:queue P31 X2
new26:graph P35 X4
new26:tree P34 X5
new26:array P56 X3
cs_dijkstra P38 X55
new26:merge_sort P39 P49 X56
new26:binary_search P42 P47 X57
cs_kruskal P44
cs_prim P45
cs_a_star P53
new26:big_o P46 X59
new26:recursion P57 X58
new26:encapsulation P69 X82
new26:inheritance P70 X83
new26:git P76 X46
new26:dns P79 X19
new26:https P80 X20
cs_dhcp P85
cs_arp P93
new26:ssh P94
new26:kernel P95 X30
cs_semaphore P100
cs_mutex P99
new26:ram P111 X29
new26:byte P112 X22
new26:hexadecimal P113 X24
new26:and_gate P114 X25
new26:not_gate P115 X27
cs_amdahl P116
gpol_suez P118 X132
gpol_panama P119 X133
new26:transylvania_romania P120 X136 C18
new26:bavaria_germany P121 X139
new26:budapest_danube P133 X84 X91
new26:danube_vienna P134 C21
new26:seine_paris P135 X86
new26:tiber_rome P136 X87
new26:thames_london P137 X85
new26:pyrenees_border P140 X119 C24
new26:andes_west P141 X120 C23
new26:everest_himalaya P144 X121
new26:kilimanjaro P145 X148
new26:sahara P146 X142 C30
new26:gobi P147 X143
new26:atacama P148 X144 C16
new26:bosporus_seas P150 C27
new26:gibraltar_strait P151 X130 C33
new26:bering_strait P152 X131
gpol_malacca P153
new26:hispaniola P154 X135 C32
new26:corsica_france P155 X137
new26:sicily_italy P156 X138
new26:borneo_shared P157 X141
gpol_lesotho_enclave P158 X134
new26:sea_catalan_coast P165 X127 Y164
new26:dubrovnik_croatia P167 C36
new26:greenland_denmark P172
new26:kaliningrad_russia P173
new26:berlin_wall P175 P176 X158 C52 C77
gpol_maastricht P177 X157
new26:un_general_assembly P178 X154
new26:nato P179 X155 C71
new26:brexit P180 X159
new26:versailles P181 C50
new26:byzantine_constantinople P182 C43
new26:persian_satraps P183 C55
new26:nuremberg_trials P185 C69
new26:mont_blanc_alps P193 C25
new26:africa_east_ocean P200 X129
bio_p_wave T1
new26:ecg_qrs T2
bio_t_wave T3
new26:emg T4 Y89
bio_eeg T5 Y27
new26:ecg T6 T73 Y96
new26:hemoglobin T7
new26:b_cell_antibodies T8 Y200
new26:right_ventricle T9
new26:left_ventricle T10
new26:mitral T11 Y56
new26:tricuspid T12 Y57
new26:pulmonary_artery T14 Y1
new26:pancreas_insulin T16 C89
new26:insulin_glucose T18 Y3 C90
new26:axon T20 Y25
sci_mito T21 Y48 C84
sci_ribosome T22 Y51
new26:mitosis T24 Y49
new26:cartilage T30 Y8
new26:si_pressure T31 C95
new26:si_force T32 C96
new26:si_resistance T34 C94
new26:si_frequency T35 C97
bio_hooke T36
bio_poiseuille T40
bio_biocompatibility T43 Y92
new26:titanium_implants T44 Y91
new26:collagen T47 Y52
new26:biodegradable T49 Y94
new26:printing_3d T50 Y93
new26:mri T52 Y31
new26:ultrasound_imaging T53 Y29 Y39
new26:ct T54 Y32
new26:pet T55 Y41
bio_spect T56
bio_t2 T58
bio_t1 T59
bio_doppler T60
bio_hounsfield T65
new26:x_ray_imaging T67 Y30 Y40
bio_pacs T69
bio_dicom T70 Y95
new26:pulse_oximeter T72 Y33
new26:blood_pressure_instrument T75 Y35
bio_transducer T77
bio_adc T78
bio_dac T79
bio_aliasing T86
bio_snr T89
bio_sensitivity T99
bio_specificity T100
mus_perfect_fifth T102 T107 Y126
mus_major_third T103 T108 Y125
mus_perfect_fourth T104 Y133
mus_major_second T105
mus_octave T106
mus_flat T109 C178
mus_sharp T110
mus_natural T111 Y111
mus_half_note T112 Y115 Y118
mus_whole_note T113 Y114
mus_eighth_note T114 Y116
mus_sixteenth_note T115 Y117
mus_dot T118 Y110
new26:bar_line T119 Y132
mus_treble_clef T120 Y100
mus_bass_clef T121 Y101
mus_soprano T122 T144 Y104
mus_contralto T123 Y105
mus_tenor T124 T146 Y106
mus_bass T125 T147 Y107
new26:baritone T126 Y108
mus_a_cappella T127
new26:choir T128
mus_choir_director T129 Y128
mus_unison T130 Y129
mus_crescendo T132 Y122
mus_diminuendo T133 Y123
mus_piano T134 Y121
mus_forte T135 Y120
new26:adagio T136 Y130
new26:allegro T137 Y131
mus_vibrato T138 Y135
mus_diaphragm T139 Y5 Y134
new26:tempo T141 Y124
mus_alto T145
sit_fire_beasts T151
sit_giants_pairs T152
sit_giants_types T153
sit_bastons_groups T154
sit_devil_groups T155
sit_gitanes_groups T156
sit_castellers T157 T199 Y156
sit_abps T158 Y179
sit_grallers_1971 T159
new26:cobla_maricel T160
new26:cobla_sitgetana T161
new26:moixiganga_passion T165 Y153
new26:ball_bastons T166 Y149 C142
new26:ball_cercolets T167 Y150
new26:ball_cintes T168 Y151 Y152 C143
new26:ball_pastorets T169 Y154
new26:ball_gitanes T171 Y186
new26:gralla_accompaniment T172 Y155 Y178 C121
new26:geants_figures T173 Y180 C140
new26:panxita T174
new26:panxito T175
new26:fa_luch T176 Y145
new26:la_hia T177 Y146
sit_august_patron T180 Y140 C148
sit_september_patron T181 Y139 C147
new26:punta_church T182 Y160
new26:cau_ferrat T183 Y161 Y183 C150
new26:palau_maricel T184 Y169 Y171
new26:beach_sant_sebastia T185 Y167
new26:passeig_maritim T186 Y181
new26:rusinol_cau T188
new26:sitges_corpus T189 Y158 Y188 C145
new26:sitges_drac T191 Y147 C144
new26:sitges_aliga T192 Y148
new26:grallers T193 Y176
new26:cabecuts T197 Y174 C139
new26:baluard_square T198 Y159
new26:sitges_carnaval T200 Y157 C146
new26:flandes_belgium X140 C39
new26:atlantic_europe_america X128 C29
new26:africa_country_count X147 C31
new26:petra_jordan X151 C11
new26:cetaceans X161 C115
new26:tundra X171 C116
ast_saturn X183 C98
ast_mercury X184
ast_mars X185
ath_hurdles400 X186
new26:marathon X189
ath_heptathlon_events X191
ath_relay_object X192
ath_lap400 X193
ath_laps1500 X194
ath_sprint_start X200
new26:dna_genetic Y50 C83
mus_staff_lines Y99
new26:terramar Y142 Y166
new26:sitges_garraf Y163 C149
new26:sitges_punta Y182
new26:neuron_sodium Y46 Y190
new26:femur Y73 C87
new26:spirometry Y87 Y197
new26:stapes Y77 C88
new26:circulatory_system Y83 C86
chem_26_name C78
chem_47_name C79
chem_50_name C80
chem_82_name C81
sci_translation C91
sci_transcription C92
cult_mohs C93
ast_jupiter C99
new26:mercury_metal C113
new26:bat_flight C114
new26:castells C118 Y175
cult_pinya C119
cult_enxaneta C120
cult_tenora C124
cult_cobla_tible C125
cult_tambori C126
cult_cobla_contrabass C127
new26:castanyada C131 C132
new26:sant_joan C133 C134
new26:montserrat_monastery C154 C155
cult_aran_language C156
new26:andorra_catalan C157
cult_flabiol C158 Y173
new26:patum C159
cult_guernica C165
cult_persistence_memory C167
cult_bolero C174
cult_four_seasons C177
cult_don_quixote C180
cult_metamorphosis C181
cult_rodoreda C182
cult_tirant C188
cult_odyssey C189
cult_hundred_years C192
cult_las_meninas C199
'''

# Editorial/factual findings, individual questions rather than invented fixes.
ISSUES = '''
P21 AMBIGUITY: B-tree i B+tree són índexs equilibrats; falta concretar el tipus.
P56 X3 AMBIGUITY: array, vector i altres seqüències admeten accés per índex.
P64 FACTUAL: throw llança una excepció; no la declara.
P77 AMBIGUITY: merge i rebase poden combinar el treball de branques.
P99 AMBIGUITY: mutex i semàfor binari poden protegir una secció crítica.
P148 FACTUAL_PENDING: l'extensió d'Atacama al Perú depèn de la delimitació del desert.
P155 AMBIGUITY: França té diverses illes mediterrànies, no només Còrsega.
P156 AMBIGUITY: Sicília i Sardenya són illes mediterrànies i regions italianes.
P181 AMBIGUITY: cal distingir el cessament d'hostilitats de 1918 i el tractat de pau de 1919.
T17 AMBIGUITY: també cortisol, adrenalina i altres hormones augmenten la glucèmia.
T37 AMBIGUITY: força/superfície també defineix la pressió; falta precisió mecànica.
T39 AMBIGUITY: pressió, tensió i mòduls elàstics es mesuren en pascals.
T51 FACTUAL: autoclau és l'aparell; el procés és esterilització amb vapor.
T59 AMBIGUITY: el greix també pot ser brillant en T2; falta precisar la seqüència.
T66 LANGUAGE: cal «dues energies», no «dos energies».
T74 AMBIGUITY: termistor i RTD canvien resistència amb la temperatura.
T91 AMBIGUITY: cal precisar els supòsits de variància per distingir Student i Welch.
T92 AMBIGUITY: falten els supòsits paramètrics; també existeix Kruskal–Wallis.
T95 AMBIGUITY: rang i altres mesures de dispersió també tenen les unitats originals.
T96 FACTUAL: el coeficient de variació és desviació estàndard/mitjana, no variància/mitjana.
T124 Y106 AMBIGUITY: el contratenor pot ser més agut que el tenor; cal limitar-ho a SATB.
T136 Y130 AMBIGUITY: adagio, largo i altres indicacions expressen lentitud.
T137 Y131 AMBIGUITY: allegro, presto i altres indicacions expressen rapidesa.
T154 T155 T156 AMBIGUITY: falta especificar Sitges a la pregunta, independent de les anteriors.
T173 AMBIGUITY: «quins dos elements» no encaixa amb tres parelles de gegants.
T168 T171 Y186 AMBIGUITY: Cintes i Gitanes poden fer figures i trenats amb cintes; manca un tret distintiu.
T178 T179 FACTUAL: el protocol distingeix gegants vells i nous, sense nom oficial; noms populars Jordi i Maria Rosa només dels nous.
T183 AMBIGUITY: diferents museus sitgetans poden conservar obres de Rusiñol.
T187 SOURCE_PENDING: cal confirmar el nom històric del barri sota la Punta.
T196 AMBIGUITY: també Vilanova i la Geltrú, al Garraf, és coneguda pel carnaval.
X21 AMBIGUITY: tant IP com MAC poden identificar un dispositiu en una xarxa.
X31 AMBIGUITY: Linux i altres sistemes oberts, com FreeBSD, són habituals en servidors.
X38 AMBIGUITY: NumPy, SciPy i altres biblioteques ofereixen càlcul numèric.
X39 AMBIGUITY: Python, R i altres llenguatges són populars per a dades i scripts.
X45 AMBIGUITY: Parquet i ORC són formats columnars populars.
X46 TERMINOLOGY: Git és un sistema de control de versions, no un servei.
X47 AMBIGUITY: GitHub, Bitbucket i altres plataformes utilitzen pull requests.
X54 AMBIGUITY: Excel, Google Sheets i altres eines són populars per a fulls de càlcul.
X59 AMBIGUITY: O, Omega i Theta expressen cotes asimptòtiques; falta «superior».
X71 AMBIGUITY: llista i bytearray són seqüències modificables.
X72 AMBIGUITY: tupla, str, bytes i range són seqüències immutables.
X90 EDITORIAL: el nom de la ciutat ja apareix a la pregunta.
X124 AMBIGUITY: tant Roine com Saona travessen Lió.
X194 EDITORIAL: la pregunta ja conté «tres quarts» de la resposta.
Y42 AMBIGUITY: T3 i T4 són hormones tiroïdals que contenen iode.
Y49 AMBIGUITY: mitosi i fissió binària poden produir dues cèl·lules filles; falta context.
Y50 C83 AMBIGUITY: ADN i ARN poden portar informació genètica; falta limitar-ho a cèl·lules.
Y75 EDITORIAL: la pregunta ja inclou «mandíbula inferior».
Y91 AMBIGUITY: també s'utilitzen aliatges de cobalt-crom, entre altres materials de maluc.
Y109 Y112 Y113 AMBIGUITY: falta especificar escala diatònica; en una cromàtica hi ha alteracions intermèdies.
Y134 FACTUAL_PENDING: el control de l'expiració cantada no depèn principalment només del diafragma.
Y147 AMBIGUITY: tant el Drac com l'Àliga tenen ales i treuen foc.
Y151 Y152 C143 AMBIGUITY: el Ball de Cintes i el de Gitanes utilitzen i trenen cintes.
Y165 AMBIGUITY: més d'una platja es troba prop del port d'Aiguadolç.
Y168 AMBIGUITY: la Ribera, la Fragata i altres platges són davant del centre.
Y169 SOURCE_PENDING: falta concretar l'edifici i els concerts per evitar alternatives.
Y170 AMBIGUITY: cal distingir antiguitat de les figures actuals i de la tradició de cada parella.
Y190 AMBIGUITY: sodi, potassi i altres ions són necessaris per a l'impuls nerviós.
Y191 AMBIGUITY: vestíbul i canals semicirculars participen en l'equilibri.
C4 TERMINOLOGY: Berna és ciutat federal; Suïssa no designa formalment una capital.
C16 AMBIGUITY: falta concretar la delimitació territorial del desert d'Atacama.
C21 AMBIGUITY: el Danubi i el riu Wien travessen Viena.
C26 AMBIGUITY: l'Adriàtic i el Jònic separen parts d'Itàlia i els Balcans.
C46 AMBIGUITY: també Herculà i altres ciutats foren destruïdes pel Vesuvi el 79.
C68 FACTUAL: la Revolució Francesa comença abans de la presa de la Bastilla.
C70 AMBIGUITY: diverses organitzacions internacionals es van crear el 1945.
C117 AMBIGUITY: evaporació i ebullició transformen aigua líquida en vapor.
C124 C125 AMBIGUITY: altres instruments de cobla tenen registres greus/aguts; cal especificar instruments de doble canya.
C128 EDITORIAL: «havaneres» ja apareix a la pregunta que demana «havanera».
C144 AMBIGUITY: diverses bèsties festives representen animals que escupen foc.
C168 SOURCE_PENDING: falta identificar els murals i la Fundació; no s'ha confirmat la premissa.
C185 FACTUAL: Arthur Conan Doyle era escocès; «escriptor anglès» és incorrecte.
'''

SOURCES = {
    'sitges_protocol': 'https://continguts.radiomaricel.cat/continguts/2023/04/26/PROTOCOL_FESTA_MAJOR_FITXES_BALLS.pdf',
    'sitges_seguici': 'https://www.sitgesfestamajor.cat/sobre-la-festa/el-seguici-popular/',
    'grallers': 'https://escoladegrallersdesitges.cat/escola/',
    'sql_aggregate': 'https://www.postgresql.org/docs/current/functions-aggregate.html',
    'sql_select': 'https://www.postgresql.org/docs/current/sql-select.html',
    'variation': 'https://itl.nist.gov/div898/software/dataplot/refman2/auxillar/coefvari.htm',
    'b_cells': 'https://www.ncbi.nlm.nih.gov/books/NBK26884/',
    'sitges_history': 'https://www.sitgesfestamajor.cat/sobre-la-festa/el-seguici-popular/recorregut-historic/',
    'conan_doyle': 'https://www.conandoylecollection.com/conan-doyle/arthur-conan-doyle/a-chronology-of-conan-doyles-life',
    'swiss_capital': 'https://www.aboutswitzerland.eda.admin.ch/en/political-system',
}

# Human-reviewed legacy links. This changes a private alias table only; neither
# the 130 original question rows nor existing usage snapshots are rewritten.
LEGACY_LINKS = '''
C157 common_004
C123 common_005 ptecla_014
C124 common_006 ptecla_011 tecla_014
X177 common_009
C114 common_011
C28 common_012 pau_017
C187 common_015
C113 common_018
P135 common_022
P144 common_023 pau_026
P165 common_003
X67 pau_001 tpau_001
P30 pau_002
X18 pau_003 tpau_003
P15 pau_004
P57 pau_005
X44 pau_007
P25 pau_008
P76 pau_010 tpau_005
X37 pau_011
P80 pau_014
X68 pau_015
X122 pau_018
P145 pau_019
P151 pau_020
C112 pau_025
P83 tpau_004
X80 tpau_006
P200 tpau_013
P137 tpau_015
X162 tpau_017
X176 tpau_019
T10 tecla_002
T7 tecla_003
T75 tecla_004
T52 tecla_005
T6 tecla_006 ptecla_023
T35 tecla_008
T128 tecla_012 ptecla_010
T166 tecla_017 ptecla_015
T172 tecla_018 ptecla_016
T182 tecla_019 ptecla_017
T191 tecla_021 ptecla_018
Y14 tecla_023
T11 tecla_024
Y88 tecla_025
Y12 ptecla_008
T67 ptecla_022
Y112 ptecla_026
'''

def read_excel(path):
    with zipfile.ZipFile(path) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(t.text or '' for t in n.findall('.//{*}t'))
                       for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('{*}si')]
        rows = []
        for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//{*}row'):
            cells = {}
            for cell in row.findall('{*}c'):
                if cell.find('{*}f') is not None:
                    raise ValueError('Formula in question data; review source manually')
                value = cell.find('{*}v')
                kind = cell.get('t')
                text = ''.join(t.text or '' for t in cell.findall('.//{*}t')) if kind == 'inlineStr' else (
                    strings[int(value.text)] if kind == 's' and value is not None else (value.text if value is not None else ''))
                cells[re.sub(r'\d', '', cell.get('r'))] = text
            rows.append(cells)
        columns = list(rows[0])
        headers = [rows[0][c] for c in columns]
        return [dict(zip(headers, [r.get(c, '') for c in columns])) for r in rows[1:]]

def norm(text):
    text = ''.join(c for c in unicodedata.normalize('NFD', text.lower()) if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', ' ', text).strip()

def review(rows, old):
    assert len(rows) == 1000 and Counter(r['pool'] for r in rows) == Counter(POOLS)
    assert len({r['id'] for r in rows}) == 1000
    assert len({norm(r['question_ca']) for r in rows}) == 1000
    by_id = {r['id']: r for r in rows}
    concepts = {r['id']: 'new26:' + r['id'].lower() for r in rows}
    assigned = set()
    for line in GROUPS.strip().splitlines():
        key, *refs = line.split()
        for ref in refs:
            ident = identifier(ref)
            assert ident in by_id and ident not in assigned, 'Duplicate semantic assignment ' + ident
            concepts[ident] = key
            assigned.add(ident)
    # Reuse the previous canonical capital relation in both directions. This
    # connects old-game history without modifying any original question row.
    countries = {norm(r['answer_ca']): r['semantic_key'] for r in old
                 if r['fact_id'].startswith('geo_') and r['fact_id'].endswith('_country_by_capital')}
    capitals = {norm(r['answer_ca']): r['semantic_key'] for r in old
                if r['fact_id'].startswith('geo_') and r['fact_id'].endswith('_capital')}
    capitals.update({'vilnius': 'geo_ltu_capital', 'bogota': 'geo_col_capital', 'tallinn': 'geo_est_capital'})
    countries.update({'etiopia': 'geo_eth_capital', 'mongolia': 'geo_mng_capital', 'islandia': 'geo_isl_capital',
                      'turquia': 'geo_tur_capital', 'nepal': 'geo_npl_capital', 'uruguai': 'geo_ury_capital',
                      'estonia': 'geo_est_capital', 'letonia': 'geo_lva_capital', 'eslovaquia': 'geo_svk_capital',
                      'eslovenia': 'geo_svn_capital', 'georgia': 'geo_geo_capital', 'armenia': 'geo_arm_capital'})
    # The previous bank does not cover every new country. Direct questions and
    # inverse questions complete each other's relation, including city aliases.
    for r in rows:
        q = norm(r['question_ca'])
        if not q.startswith('quina es la capital '): continue
        country = re.sub(r'^(?:del |de l |de |d )', '', q.split('capital ', 1)[1])
        key = capitals.get(norm(r['answer_ca'])) or countries.get(country) or 'new26:capital:' + country.replace(' ', '_')
        countries[country] = key
        capitals[norm(r['answer_ca'])] = key
        concepts[r['id']] = key
    for r in rows:
        if 'capital' not in r['question_ca']: continue
        capital = re.search(r' té (.+?) (?:per|com a) capital', r['question_ca'])
        if capital:
            country = norm(r['answer_ca'])
            key = countries.setdefault(country, 'new26:capital:' + country.replace(' ', '_'))
            capitals[norm(capital[1])] = key
    for r in rows:
        q = norm(r['question_ca'])
        if 'capital' in q and ('pais' in q or 'republica' in q):
            key = countries.get(norm(r['answer_ca']))
            if key: concepts[r['id']] = key
    issues = defaultdict(list)
    for line in ISSUES.strip().splitlines():
        match = re.match(r'((?:[PTXYC]\d+\s+)+)([A-Z_]+:.*)', line)
        assert match, line
        for ref in match[1].split():
            ident = identifier(ref)
            assert ident in by_id
            issues[ident].append(match[2])
    reviewed = []
    variants = Counter()
    for source in rows:
        r = dict(source)
        assert re.fullmatch(r'NEW26-(PAU|TECLA|TECLA_PAU|PAU_TECLA|TP)-\d{3}', r['id'])
        assert 1 <= int(r['difficulty']) <= 7 and 1 <= len(r['answer_ca'].split()) <= 5
        assert r['question_ca'].endswith('?') and not any(c in r['question_ca'] + r['answer_ca'] for c in ['�', '\x00'])
        assert r['review_status'] == 'PENDING_REVIEW' and r['active'] == '0'
        key = concepts[r['id']]
        variants[(r['pool'], key)] += 1
        reasons = issues[r['id']]
        approved = not reasons
        r.update(difficulty=int(r['difficulty']), subtopic=r['topic'], original_fact_id=r['fact_id'],
                 fact_id=key, semantic_key=key, variant_no=variants[(r['pool'], key)],
                 accepted_answers=[r['answer_ca']], answer_word_count=len(r['answer_ca'].split()),
                 source_key='workbook-1000', source_url=r['source_hint'] or None,
                 review_status='APPROVED' if approved else 'DRAFT', active=approved,
                 factual_checked=approved, language_checked=approved,
                 review_note=' | '.join(reasons), source_verified=False)
        if r['topic'] == 'Sitges':
            r['source_url'] = SOURCES['sitges_protocol']
        reviewed.append(r)
    return reviewed

def write_jsonl(path, rows):
    path.write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows))
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('workbook', type=Path)
    parser.add_argument('--output', type=Path, default=Path('data/question-bank-1000'))
    args = parser.parse_args()
    rows = read_excel(args.workbook)
    old = [json.loads(line) for line in Path('data/question-bank/reviewed_5000.jsonl').read_text().splitlines()]
    reviewed = review(rows, old)
    args.output.mkdir(parents=True, exist_ok=True)
    canonical_hash = write_jsonl(args.output / 'questions_1000.jsonl', rows)
    reviewed_hash = write_jsonl(args.output / 'reviewed_1000.jsonl', reviewed)
    groups = defaultdict(list)
    for r in reviewed: groups[r['semantic_key']].append(r['id'])
    old_keys = {r['semantic_key'] for r in old}
    report = {'version': VERSION, 'source': args.workbook.name,
              'sourceSha256': hashlib.sha256(args.workbook.read_bytes()).hexdigest(),
              'canonicalSha256': canonical_hash, 'reviewedSha256': reviewed_hash,
              'read': len(rows), 'approved': sum(r['active'] for r in reviewed),
              'draft': sum(not r['active'] for r in reviewed), 'exactDuplicateTexts': 0,
              'selectionFacts': len(groups), 'conceptualDuplicateGroups': sum(len(ids) > 1 for ids in groups.values()),
              'oldCanonicalConceptsLinked': len(set(groups) & old_keys),
              'pools': {pool: {'imported': 200, 'active': sum(r['pool'] == pool and r['active'] for r in reviewed),
                                'draft': sum(r['pool'] == pool and not r['active'] for r in reviewed),
                                'activeFacts': len({r['semantic_key'] for r in reviewed if r['pool'] == pool and r['active']})}
                        for pool in POOLS}, 'topics': dict(Counter(r['topic'] for r in rows)), 'sourcesConsulted': SOURCES}
    (args.output / 'conceptual_duplicates.json').write_text(json.dumps({k: ids for k, ids in groups.items() if len(ids) > 1}, ensure_ascii=False, indent=2) + '\n')
    by_id = {r['id']: r for r in reviewed}
    aliases = {}
    legacy_ids = {r['id'] for r in json.loads(Path('data/questions_approved.json').read_text())}
    for line in LEGACY_LINKS.strip().splitlines():
        ref, *ids = line.split()
        key = by_id[identifier(ref)]['semantic_key']
        for ident in ids:
            assert ident in legacy_ids and ident not in aliases
            aliases[ident] = key
    for r in old:
        if r['semantic_key'] in {'sit_bastons_instrument', 'cult_gralla_castells'}:
            aliases[r['id']] = by_id[identifier('T172')]['semantic_key']
    (args.output / 'historical_concept_links.json').write_text(json.dumps([{'question_id': ident, 'semantic_key': key} for ident, key in sorted(aliases.items())], ensure_ascii=False, indent=2) + '\n')
    report['historicalLinks'] = len(aliases)
    report['historicalLinksSha256'] = hashlib.sha256((args.output / 'historical_concept_links.json').read_bytes()).hexdigest()
    (args.output / 'AUDIT.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    with (args.output / 'review_issues.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=['id', 'pool', 'fact_id', 'review_status', 'reason'])
        writer.writeheader()
        writer.writerows({'id': r['id'], 'pool': r['pool'], 'fact_id': r['fact_id'], 'review_status': r['review_status'], 'reason': r['review_note']} for r in reviewed if not r['active'])
    print(json.dumps(report, ensure_ascii=False))

if __name__ == '__main__': main()
