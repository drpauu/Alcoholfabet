# Revisió de les 1.000 preguntes

Font efectiva: `questions_1000.xlsx`, versió `excel-1000-20261010-v1`. El paquet i el prompt nous no estan presents; s’ha convertit l’Excel després de comunicar-ho a l’usuari. S’han llegit les instruccions, el resum i totes les files abans d’importar.

El JSONL canònic conserva els 13 camps originals. La revisió manté els textos i afegeix `original_fact_id`, claus globals i decisions explícites: 913 files aprovades i 87 inactives amb motiu a `review_issues.csv`. No es corregeixen silenciosament les preguntes per forçar una resposta única. Una formulació problemàtica pot quedar quarantinada mentre una formulació correcta del mateix concepte continua aprovada.

S’agrupen 186 conjunts de formulacions equivalents en 770 conceptes totals, 710 actius. S’inclouen inversions capital–país i preguntes creuades; no s’agrupa només per resposta. Mercuri planeta i mercuri metall són conceptes diferents. `conceptual_duplicates.json` documenta els grups detectats; no és una garantia de detectar qualsevol equivalència possible de llenguatge natural.

142 conceptes reutilitzen claus antigues i `historical_concept_links.json` conté 77 equivalències addicionals. Es mantenen privades al servidor sense reescriure els snapshots històrics.

S’han consultat el [protocol de Festa Major](https://continguts.radiomaricel.cat/continguts/2023/04/26/PROTOCOL_FESTA_MAJOR_FITXES_BALLS.pdf), el [seguici popular](https://www.sitgesfestamajor.cat/sobre-la-festa/el-seguici-popular/), el [recorregut històric](https://www.sitgesfestamajor.cat/sobre-la-festa/el-seguici-popular/recorregut-historic/) i l’[Escola de Grallers](https://escoladegrallersdesitges.cat/escola/) per revisar tradicions i noms locals.

Altres punts s’han contrastat amb PostgreSQL sobre [agregació](https://www.postgresql.org/docs/current/functions-aggregate.html) i [SELECT](https://www.postgresql.org/docs/current/sql-select.html), el [NIST sobre variació](https://itl.nist.gov/div898/software/dataplot/refman2/auxillar/coefvari.htm), el [capítol NCBI sobre limfòcits B](https://www.ncbi.nlm.nih.gov/books/NBK26884/), la [cronologia de Conan Doyle](https://www.conandoylecollection.com/conan-doyle/arthur-conan-doyle/a-chronology-of-conan-doyles-life) i el [sistema polític suís de l’FDFA](https://www.aboutswitzerland.eda.admin.ch/en/political-system).

Aquestes fonts no certifiquen cada fila aprovada. Els `source_hint` sovint només remeten a programes docents; una URL de protocol tampoc prova qualsevol afirmació sobre un edifici de Sitges. `source_verified` és `false` a totes les files. Les aprovades han passat la revisió disponible; les dubtoses romanen inactives. Una correcció futura requereix nova revisió i versió, sense reescriure un banc publicat.

La verificació de persistència compara independentment totes les preguntes, respostes i metadades amb l’artefacte revisat i exigeix les 1.000 proves abans de publicar. El banc cru i l’Excel queden fora del desplegament i bloquejats al servidor de desenvolupament.

Vegeu [l’informe de migració](../../QUESTION_BANK_1000_MIGRATION_REPORT.md).
