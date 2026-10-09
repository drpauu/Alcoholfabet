# 12 — Sistema de preguntes

## Regla editorial

Una pregunta ha de ser:

- curta;
- directa;
- conceptual;
- inequívoca;
- fàcil de validar oralment;
- sense opinió;
- sense explicació llarga;
- sense llistes extenses;
- amb resposta d'1 a 5 paraules.

No utilitzar `explica`, `per què` o `què en penses`.

## Piles

### PAU

Nivell mitjà o alt en:

- informàtica;
- programació;
- dades;
- bases de dades;
- algorismes;
- geografia;
- geopolítica estable;
- atletisme;
- natura i animals.

### TECLA

Nivell mitjà o alt en:

- enginyeria biomèdica;
- anatomia;
- tecnologia mèdica;
- música;
- cant i cant coral;
- folklore català;
- cultura de Sitges.

### TECLA_PAU

La Tecla respon sobre en Pau i els seus temes, a nivell fàcil.

### PAU_TECLA

En Pau respon sobre la Tecla i els seus temes, a nivell fàcil.

### TP

Cultura general, Catalunya, folklore, geografia, natura, música, història i ciència bàsica.

## Estat editorial

- `DRAFT`.
- `APPROVED`.
- `ARCHIVED`.

Només entra en partida si:

- `reviewStatus = APPROVED`;
- `active = true`;
- `factualReviewed = true`;
- `languageReviewed = true`.

## Repeticions

- Mai repetir dins de la mateixa partida.
- Si hi ha prou inventari, evitar les últimes tres partides.

## Fitxers

- `data/questions_approved.json`: banc inicial usable.
- `data/questions_approved.csv`: versió tabular.
- `data/questions_draft_to_review.json`: preguntes o plantilles pendents.
- `validation/questions.schema.json`: esquema.
- `validation/validate_questions.py`: validador.
