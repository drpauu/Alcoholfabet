# 03 — Fluxos i pantalles

Les referències visuals separades són a `assets/reference/screens/`.

## 1. Accés privat

Primera visita del dispositiu:

- Títol: `Entra al joc de Pau i Tecla`.
- Camp: `Codi privat`.
- Botó: `Entrar`.
- No mostrar marcador ni partida abans de validar.
- El codi es valida al servidor i no es desa en text pla al client.

## 2. Pantalla inicial

- Logotip `Pau & Tecla`.
- Avatars il·lustrats.
- Un únic marcador general: `Pau X — Y Tecla`.
- `Jugar en persona`.
- `Jugar en línia`.
- `Normes`.
- Control de so discret.
- `Reprendre la partida` si n'hi ha una d'activa.

## 3. Selecció de mode

Targetes:

- `En persona` — `Un sol dispositiu. Al vostre costat.`
- `En línia` — `Dos dispositius. Des de qualsevol lloc.`

## 4. Durada

- Títol: `Quant de temps voleu que duri la partida?`
- 20, 30, 45, 60 minuts i Personalitzada.
- Selecció molt tàctil.

## 5. Qui comença

- `Qui comença?`
- `En Pau`.
- `La Tecla`.
- `A l'atzar`.

L'opció aleatòria mostra una animació breu, però el resultat es desa al servidor.

## 6. Crear o unir-se

- `Crear una partida`.
- `Unir-se a una partida`.
- `Soc en Pau`.
- `Soc la Tecla`.
- No permetre dos dispositius amb el mateix rol.

## 7. Sala d'espera online

- Codi curt sense caràcters ambigus.
- Botó copiar.
- Botó compartir.
- Estat d'en Pau i de la Tecla.
- `Connectat` / `En espera…`.
- `Començar la partida` només quan tots dos hi són.

## 8. Tauler abans del torn

- Tauler complet.
- Peces.
- Casella següent destacada.
- `Torn d'en Pau` o `Torn de la Tecla`.
- `Començar el torn`.

## 9. Pregunta online: vista de qui respon

- Torn i categoria.
- Pregunta.
- Cap resposta.
- Cap control de validació.
- Text secundari: `Respon en veu alta!`.

## 10. Pregunta online: vista de qui jutja

- Mateixa pregunta.
- `Resposta correcta`.
- Resposta gran.
- `Incorrecte` i `Correcte`.

## 11. Pregunta presencial

- Pregunta sense resposta.
- `Mostra la resposta`.
- Després de revelar: resposta i controls de validació.

## 12. T&P

Abans de reclamar:

- Pregunta.
- `Jo responc!` als dos dispositius.

Després:

- `Respon en Pau` o `Respon la Tecla`.
- Només el dispositiu contrari obté la resposta.

## 13. Resultat correcte

- `Correcte!`
- `Avances una casella.`
- Animació de peça.

## 14. Resultat incorrecte

- `Incorrecte!`
- `No avances.`
- `Perds el torn.`
- `Beu.`

## 15. +1

- `+1!`
- `Avances una casella addicional.`
- En error: `Beu doble.`

## 16. Desconnexió

- `S'ha perdut la connexió`.
- `S'està reconnectant…`.
- Accions bloquejades.

## 17. Reconnexió

- `T'has tornat a connectar`.
- `La partida continua.`
- Recuperar estat abans de tornar a habilitar controls.

## 18. Abandonament

Modal:

- `Vols sortir de la partida?`
- `Aquesta partida no comptarà al marcador.`
- `Continuar jugant`.
- `Abandonar la partida`.

## 19. Pantalla final

- `Ha guanyat en Pau!` o `Ha guanyat la Tecla!`.
- Peça a META.
- Avatar guanyador.
- Marcador anterior → marcador nou.
- `Tornar a jugar`.
- `Anar a l'inici`.
