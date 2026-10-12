# Grafik Emisji

Działająca aplikacja demonstracyjna na podstawie [PRD v1.0](docs/PRD_Grafik_Emisji.md). React + Vite, Express, SQLite (wbudowany moduł Node.js), Luxon i ExcelJS. Interfejs po polsku, sześć syntetycznych profili i przykładowy grafik października 2026. Czcionki są dostarczane lokalnie; aplikacja nie potrzebuje CDN ani kluczy API.

## Uruchomienie

Wymagany **Node.js 24+** i npm. Z katalogu repozytorium:

```sh
npm ci --cache /tmp/grafik-npm-cache
npm test
npm run build
npm start
```

Serwer aplikacji i API działa na porcie **3001**. `PORT` zmienia port serwera. Do pracy nad interfejsem uruchom `npm run server` oraz w drugim terminalu `npm run dev`; Vite przekazuje `/api` do portu 3001. Każde zadanie chmurowe jest już izolowane — korzystaj z tego checkoutu, nie twórz dodatkowego worktree.

## Dostępne funkcje

- Pulpit: wymiar i dostępność zespołu, plan godzin, pokrycie oraz luki obsady, raport walidacji, tygodniowy podgląd, mapa obsady.
- Grafik miesięczny, tygodniowy i lista osi czasu; dodawanie/edycja/usuwanie zmian, presety 4/6/8/10/12 h, własne godziny z dokładnością do minuty, kopiowanie na jutro, blokowanie i cofanie.
- Plan oraz rzeczywiste wykonanie są osobnymi polami. Można zarejestrować wykonanie przekraczające limit planowania.
- Karty pracowników: etat, salda urlopu, UŻ wykorzystane poza planem, limit dobowy i ograniczenie nocne. Edycja w roli Kadry.
- U, UŻ, CH, UB, IN i dni wolne z kategorią. Nieobecności zachowują pierwotny kod i planowe godziny; wersja sprzed zmiany pozostaje w historii. CH w pierwotnie wolnym dniu ma 0 h podstawy. Salda są w godzinach, liczniki dni CH/UŻ oddzielnie.
- Zadania: czas, waga 1–5, właściciel i kompetencja. Punkty są prognozą obciążenia na dniach planowej pracy, nie oceną wydajności; zmiana wagi nie zmienia godzin pracy.
- Wykresy godzin, obciążenia, mapa obsady, narastający bilans i nieobecności; tabele danych i zestawienie rozkładu zmian. Wykonanie jest częściowe dopóki nie wpisano wszystkich faktycznych minut.
- Walidacja odpoczynku dobowego i doby pracowniczej, nakładania przydziałów, tygodniowej przerwy w pełnych tygodniach okresu, długości planu, wymiaru miesiąca, wybranych ograniczeń, salda urlopu i limitu UŻ.
- Zapotrzebowanie niezależne od zmian: osobne ustawienia dni roboczych, weekendów i świąt. Nakładające się przedziały sumują wymagane osoby; pokrycie maks. 100%, nadmiar osobno. Kliknięcie mapy w grafiku pokazuje przedziały i braki. Przerwy wymagające zastępstwa nie są jeszcze modelowane.
- Podpowiedź zastępstw odrzuca kandydatów z wykrytymi błędami; wymaga dodatkowej oceny kompetencji i pełnej walidacji.
- Eksport XLSX (grafik, podsumowanie, walidacja, legenda); PDF poprzez systemowy druk przeglądarki, układ A3 landscape dla całego miesiąca.
- Trwała baza SQLite, kontrola konfliktu wersji (`409`), dziennik operacji, przywracanie poprzedniego stanu z obowiązkowym powodem i spójne kopie bazy.

## Dane i kopie

Dane przechowywane są w ignorowanym `.data/grafik.sqlite`; baza powstaje automatycznie tylko przy pierwszym starcie. `GRAFIK_DATA_DIR` pozwala wskazać inny katalog. Restart nie resetuje danych.

```sh
npm run backup
```

Tworzy spójną kopię przez `VACUUM INTO` w `.data/backups/`, także podczas pracy serwera. Przywrócenie całej bazy: zatrzymaj proces aplikacji, zachowaj obecną bazę oraz jej pliki `-wal` i `-shm` w oddzielnym katalogu, skopiuj wybraną kopię jako `grafik.sqlite` do nowego katalogu i uruchom aplikację z `GRAFIK_DATA_DIR` wskazującym ten katalog. Nie nadpisuj aktywnej bazy. Historia pozwala również przywrócić stan sprzed pojedynczej operacji. Produkcja wymaga automatycznych, szyfrowanych kopii poza maszyną oraz ustalonych RPO/RTO.

## Testy

`npm test` uruchamia testy reguł i integrację API na oddzielnej, tymczasowej bazie: przypadki wymiaru, DST, odpoczynku, doby, 12/13 h, urlopu 10 h, UŻ 12 h i piątego dnia, CH w dniu wolnym, niepełnej walidacji, godzin nocnych, nakładania zapotrzebowania, konfliktu wersji, przywracania, ról i rzeczywistego XLSX.

Po uruchomieniu aplikacji `npm run test:ui` sprawdza na Chromium edycję, historię i przywrócenie, wszystkie ekrany, role oraz układ desktop/mobile. Wymaga lokalnego Chromium (`CHROMIUM_PATH`, domyślnie `/usr/bin/chromium`); `GRAFIK_URL` zmienia adres testowanego serwera. Test UI dodaje syntetyczny wpis, a następnie przywraca poprzedni stan; zachowuje ślad w historii.

## Granice prototypu i odbiór

**Nie jest to kompletne wdrożenie produkcyjne PRD.** Profile i zapotrzebowanie wymagają decyzji pracodawcy oraz odbioru kadr. Status pozostaje „niepełna walidacja”; zatwierdzenie i publikacja produkcyjnego grafiku są celowo niedostępne. Nie ma przycisku obchodzącego reguły.

Przełącznik roli to tryb demonstracyjny, nie logowanie. Backend egzekwuje ograniczenia edycji roli i maskuje szczegóły nieobecności dla odbiorcy/pracownika, ale nagłówek `x-demo-role` nie jest uwierzytelniony. Wszystkie dane muszą pozostać syntetyczne. Przed wdrożeniem potrzebne są logowanie i sesje, uprawnienia do konkretnej osoby/zespołu oraz ochrona danych. Widok „pracownik” nie jest jeszcze indywidualnym portalem pracownika.

Do uzupełnienia przed odbiorem MVP: wielomiesięczne okresy, dokładne dzielenie zmian przez granice miesięcy i prawne granice świąt/niedziel, pełne rekompensaty i wolna niedziela w czterech tygodniach, złożone ograniczenia indywidualne ze zgodami/dokumentami i datami, wersjonowanie prawnych kalendarzy i reguł, finalizacja nadgodzin dobowych/średniotygodniowych bez dublowania, zatrudnienie od/do, salda bieżące/zaległe, pełny proces wniosków oraz kolizja choroby z urlopem, podział wieloosobowych zadań, kompetencje i zastępstwa na przerwy. Obecna doba jest walidowana konserwatywnie bez wyjątków ruchomego rozkładu.

Daty nocnych zmian przypisane są do daty rozpoczęcia; w obrębie jednej zmiany czas faktycznie upływający uwzględnia DST, ale podział przez miesiące nie jest jeszcze rozliczeniem kadrowym. Punkty / godziny planu to prognoza, nie wskaźnik punktów / faktycznej pracy.

Etap drugi PRD (generator, import XLSX i zamiany pracownicze) oraz etap trzeci (integracje) nie są zaimplementowane. Dokument PRD jest specyfikacją produktu; dołączone źródła prawne wymagają niezależnej weryfikacji przez kadry.
