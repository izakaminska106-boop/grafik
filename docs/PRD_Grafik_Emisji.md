# PRD aplikacji Grafik Emisji

Wersja 1.0 • 12 października 2026 • Business Owner: Izabela Kamińska

## 1. Cel i rezultat

Aplikacja webowa do planowania i rozliczania pracy sześciu pracowników emisji zatrudnionych na pełnym etacie. Użytkownik układa grafik ręcznie, otrzymuje natychmiastową walidację, widzi pokrycie obsady oraz porównuje godziny i obciążenie merytoryczne. W kolejnym etapie aplikacja proponuje grafiki i zastępstwa. Decyzję o zatwierdzeniu podejmuje kierownik.

System ma umożliwiać pracę zmianową w prawidłowo wprowadzonym równoważnym systemie czasu pracy. Sam wybór opcji w aplikacji nie ustanawia systemu prawnego. Profil kadrowy obejmuje regulamin, okres rozliczeniowy i indywidualne ograniczenia pracowników. Praca zmianowa jest sposobem organizacji pracy, a nie odrębnym systemem czasu pracy.

Mierniki sukcesu: brak nierozwiązanych naruszeń w zatwierdzonym planie; pełne pokrycie wymaganych stanowisk albo jawny raport braków; zgodność liczników z przypadkami zatwierdzonymi przez kadry; skrócenie czasu przygotowania grafiku mierzone wobec obecnego procesu.

## 2. Użytkownicy i uprawnienia

| Rola | Uprawnienia |
|---|---|
| Kierownik emisji | Grafik, obsada, zadania, zastępstwa, zatwierdzanie i eksport |
| Kadry i administrator reguł | Okresy rozliczeniowe, limity, uprawnienia, zgody, reguły prawne |
| Pracownik | Własny grafik, preferencje, wnioski urlopowe i zamiany |
| Odbiorca raportów | Dostęp tylko do uzgodnionych danych i zestawień |

Dane zdrowotne i przyczyny nieobecności dostępne wyłącznie uprawnionym osobom. W widoku zespołu wystarczy informacja „nieobecność”. System nie przechowuje diagnoz.

## 3. Konfiguracja zespołu i obsady

Start: sześć profili pracowników, każdy 1,0 etatu. Nazwiska edytowalne. Model danych pozwala później rozszerzyć zespół i obsłużyć inne wymiary etatu.

Profil zawiera: daty zatrudnienia, etat, system i normy pracy, okres rozliczeniowy, saldo urlopu bieżącego i zaległego w godzinach, wykorzystanie urlopu na żądanie u wszystkich pracodawców w roku, godziny nadliczbowe narastająco, kompetencje, preferencje oraz ograniczenia i wymagane zgody z datami obowiązywania. Salda urlopowe i staż uprawniający do urlopu są zatwierdzane przez kadry; aplikacja nie wylicza ich wyłącznie z lat pracy w obecnej firmie.

Początkowy szablon zapotrzebowania do edycji: dni powszednie jedna osoba 07:00–15:00 i dwie osoby 15:00–23:00; weekend jedna osoba na każdy slot WER, WEP i WEN. Zapotrzebowanie świąteczne ustawiane oddzielnie. To założenie operacyjne, nie wymóg ustawowy.

Obsada określana dla przedziałów czasu i stanowisk, niezależnie od szablonów zmian. Zmiana długości slotu nie może automatycznie skracać wymaganej obsady. Podgląd ujawnia luki, nakładanie zmian i czas przekazania dyżuru. Przy domyślnych godzinach WEP i WEN występuje nakładanie 22:00–23:00 oraz przerwa 06:00–07:00; kierownik określa, czy taka obsada odpowiada potrzebom emisji.

## 4. Sloty i wybór zmian

| Kod | Domyślne godziny | Czas |
|---|---|---|
| R | 07:00–15:00 | 8 h |
| P | 15:00–23:00 | 8 h |
| WER | 07:00–15:00 | 8 h |
| WEP | 15:00–23:00 | 8 h |
| WEN | 22:00–06:00 następnego dnia | 8 h |
| Własny | Początek i koniec wybierane przez użytkownika | Według profilu prawnego |

Presety: 4, 6, 8, 10 i 12 godzin oraz własny czas z dokładnością do minuty. Dostępne tryby organizacyjne: jedna zmiana, dwie zmiany, trzy zmiany, układ mieszany. Możliwe różne długości zmian w tym samym grafiku. Nazwa „weekendowy slot” nie oznacza zastosowania odrębnego systemu pracy weekendowej z Kodeksu pracy.

Dla standardowego profilu art. 135 maksymalny planowany dobowy wymiar wynosi 12 godzin. Zmiany 16 i 24 godziny nie są dostępne w tym projekcie. Praca faktyczna przekraczająca plan musi dać się zarejestrować i oznaczyć do rozliczenia; limit planowania nie może ukrywać rzeczywistego wykonania.

Zmiana ma pełną datę i godzinę rozpoczęcia oraz zakończenia. Aplikacja uwzględnia Europe/Warsaw, zmianę czasu letniego i zimowego, czas faktycznie upływający oraz podział godzin między dni, miesiące, porę nocną i święta. Płatnych przerw ustawowych nie odejmuje od czasu pracy. Ewentualna przerwa niewliczana wymaga osobnego, zatwierdzonego profilu.

## 5. Reguły prawne i silnik walidacji

Reguły są wersjonowane i przypisane do dat obowiązywania. Podstawa: Kodeks pracy, w szczególności art. 128–135, 148–15112 i 152–168, oraz przepisy szczególne dotyczące danego pracownika. Przed uruchomieniem produkcyjnym kadry zatwierdzają konfigurację zakładową i zestaw testów.

### Wymiar czasu pracy

Dla pełnego etatu i standardowych norm: wymiar okresu = 40 h × pełne tygodnie + 8 h × pozostałe dni od poniedziałku do piątku − 8 h × święta przypadające w innym dniu niż niedziela. Tygodnie liczone od początku okresu rozliczeniowego. Kalendarz ustawowych świąt wersjonowany, z Wigilią. Nie należy utożsamiać wymiaru z liczbą faktycznych zmian pomnożoną przez 8.

Obowiązuje przeciętnie 40 h i przeciętnie pięć dni pracy tygodniowo w okresie rozliczeniowym. W danym tygodniu dopuszczalna jest inna liczba godzin i dni, jeżeli prawidłowo zbilansowano okres i zachowano odpoczynek. Przeciętny limit wraz z nadgodzinami: 48 h tygodniowo. Domyślny roczny limit nadgodzin z powodu szczególnych potrzeb pracodawcy: 150 h; inny limit wyłącznie na udokumentowanej podstawie zakładowej, z zachowaniem pozostałych ograniczeń.

Okres rozliczeniowy domyślnie miesięczny. Dłuższy okres wymaga wskazania podstawy i zatwierdzenia przez kadry. Widok miesięczny nie zeruje sald okresu wielomiesięcznego. Aplikacja nie planuje nadgodzin jako zwykłego sposobu pokrywania obsady.

### Odpoczynki i doba pracownicza

Domyślnie co najmniej 11 h nieprzerwanego odpoczynku dobowego i 35 h tygodniowego. Doba pracownicza to 24 h od rozpoczęcia pracy zgodnie z rozkładem, nie dzień kalendarzowy. Silnik kontroluje zarówno przerwy między zmianami, jak i dobę pracowniczą; samo spełnienie odstępu 11 h nie wystarcza.

Skrócenie odpoczynku tygodniowego do minimum 24 h przy ustawowo dopuszczalnej zmianie pory pracy dostępne wyłącznie jako opisany wyjątek, z podstawą i akceptacją kadr. Nie jest globalnym przełącznikiem. Ruchomy rozkład możliwy wyłącznie po potwierdzeniu jego wprowadzenia; nie usuwa wymogu odpoczynku.

Walidacja korzysta również z poprzedniego i następnego miesiąca, całego okresu rozliczeniowego oraz danych potrzebnych do kontroli wolnych niedziel. Brak danych oznacza „niepełna walidacja”, nie zielony status zgodności.

### Niedziele święta i dni wolne

Praca zmianowa może uzasadniać pracę w niedziele i święta, lecz profil musi wskazywać właściwą podstawę. Za pracę w niedzielę kontrolowany jest dzień wolny w ciągu sześciu dni przed lub po niej; gdy to niemożliwe, do końca okresu rozliczeniowego. Za święto dzień wolny do końca tego okresu. System wykrywa konieczność dalszego rozliczenia, gdy wolnego nie można udzielić. Zasadniczo przynajmniej jedna niedziela wolna w każdych czterech tygodniach.

Dzień wolny ma kategorię: przeciętnie pięciodniowy tydzień, równoważenie przedłużonej pracy, niedziela, święto lub rekompensata nadgodzin. Nie każdy wolny dzień może automatycznie spłacać każdą należność. Święto w sobotę obniża wymiar; w grafiku zmianowym system sprawdza wymiar i wymagane dni wolne, zamiast mechanicznie dodawać jeszcze jeden dzień do już zbilansowanego planu. Praca w dniu wolnym z tytułu pięciodniowego tygodnia wymaga obsługi właściwej rekompensaty.

### Noc przerwy i ograniczenia indywidualne

Pora nocna: zakładowo wskazane osiem godzin w przedziale 21:00–07:00. System liczy przecięcie zmiany z tą porą, a nie tylko slot oznaczony „noc”. WEN nie jest prawnym dyżurem pozostawania w gotowości — w projekcie oznacza normalną pracę na zmianie.

Przerwy wliczane: co najmniej 15 minut przy pracy od 6 h oraz dodatkowe 15 minut ponad 9 h. Zapotrzebowanie uwzględnia zastępstwo na przerwy tam, gdzie konieczna jest nieprzerwana obsada.

Profile ograniczeń obejmują m.in. ciążę, niepełnosprawność, opiekę nad dzieckiem oraz stanowiska szczególnie niebezpieczne lub związane z dużym wysiłkiem fizycznym albo umysłowym dla pracujących w nocy. System rozróżnia limit 8 h w systemie równoważnym dla opiekuna dziecka do 4 lat bez zgody od ograniczeń nocnych i nadgodzin dla opiekuna dziecka do 8 lat bez zgody. Ograniczenia niepełnosprawności wynikają także z odrębnej ustawy i dopuszczalnych wyjątków. Kadry ustalają, które profile dotyczą zespołu.

### Nadgodziny

Rozliczenie rozdziela nadgodziny dobowe, średniotygodniowe, godziny nocne i pracę w dni wolne. Przy prawidłowo zaplanowanych 10 lub 12 h samo przekroczenie 8 h nie oznacza nadgodzin. System nie dubluje nadgodzin dobowych i średniotygodniowych. Rozliczenie średniotygodniowe finalizowane po zakończeniu okresu; wcześniej prezentowana prognoza. Wynagrodzenia i dodatki przekazywane do kadr jako dane do rozliczenia, bez kalkulacji płac w MVP.

## 6. Urlopy choroba i pozostałe nieobecności

| Kod | Obsługa i liczniki |
|---|---|
| U | Urlop wypoczynkowy; odejmuje godziny z planu od puli |
| UŻ | Urlop na żądanie; część puli wypoczynkowej i oddzielny licznik do 4 dni w roku |
| CH | Choroba; dni kalendarzowe nieobecności i oddzielnie utracone planowe godziny |
| UB | Urlop bezpłatny; osobna kategoria i akceptacja |
| IN | Inna usprawiedliwiona nieobecność; typ prawny określony przez kadry |
| W | Wolne; z obowiązkowym powodem rozliczeniowym |

Standardowa roczna pula urlopu: 20 lub 26 dni, czyli 160 lub 208 h przy normie 8 h, z korektami uprawnień i saldem zaległym. Urlop na zaplanowanej zmianie 10 h zużywa 10 h puli. Jeden dzień UŻ na zmianie 12 h zużywa 12 h urlopu oraz jeden z czterech dni na żądanie. UŻ nie stanowi dodatkowych czterech dni ponad urlop wypoczynkowy.

Usprawiedliwiona nieobecność zmniejsza wymiar do przepracowania o godziny przypadające do pracy według właściwego rozkładu. Choroba w dniu wolnym nie tworzy fikcyjnych 8 h pracy. Nieobecności nie są godzinami faktycznie przepracowanymi i nie generują punktów obciążenia.

System zachowuje plan stanowiący podstawę rozliczenia nieobecności. Nie wolno automatycznie usuwać pierwotnych zmian po zgłoszeniu choroby. Jeśli urlop zgłoszono przed przygotowaniem grafiku, kierownik wskazuje planową podstawę godzinową; system nie zgaduje jej jako zawsze 8 h. Nakładanie choroby na urlop uruchamia korektę zgodną z decyzją kadr i historią zmian.

Wnioski mają statusy: zgłoszony, zaakceptowany, odrzucony, wycofany. CH jest rejestrowana jako potwierdzona nieobecność, a nie uznaniowo zatwierdzany urlop. Alerty obejmują przekroczenie salda, kończący się limit UŻ, zaległy urlop do 30 września następnego roku oraz planowanie jednej części wypoczynku obejmującej co najmniej 14 kolejnych dni kalendarzowych. Dla CH nie ustala się „limitu dni choroby do wykorzystania”.

## 7. Obciążenie merytoryczne

Celem jest rozdzielanie trudnych zadań, a nie ocena wartości pracownika. Kierownik definiuje wydarzenia i zadania: liczba równoległych anten, transmisje LIVE, zmiany ramówki, przekazania, produkcje wymagające koordynacji i zadania administracyjne. Każde ma czas, poziom trudności, wymagane kompetencje i właściciela.

Początkowy model produktowy do kalibracji: punkty zadania = czas aktywnego zaangażowania w godzinach × waga trudności 1–5. Punkty osoby = suma przypisanych punktów. Raport pokazuje również punkty na godzinę faktycznej pracy. Wieloosobowe zadanie ma jawny podział punktów. Nakładające się zadania mogą podnieść obciążenie, ale nie liczbę godzin prawnie przepracowanych.

Wagi ustala kierownik; nie są normą prawną ani automatyczną oceną wydajności. Alert przeciążenia powstaje po przekroczeniu uzgodnionego progu lub po serii intensywnych zmian. Porównania uwzględniają dostępność, kompetencje i nieobecności. Preferencje i równomierność punktów nigdy nie uchylają reguł prawa.

## 8. Ekrany i wykresy

1. Pulpit: wymagane i obsadzone osobogodziny, luki, wymiar zespołu, dostępność po nieobecnościach, naruszenia, status walidacji.
2. Grafik: osoby w wierszach, daty w kolumnach; widok miesiąca, tygodnia i osi czasu; wybór slotu, edycja godzin, kopiowanie, cofanie, blokowanie wpisów.
3. Karta pracownika: plan, wykonanie, saldo okresu, noc, weekendy, dni wolne według kategorii, urlop i ograniczenia.
4. Nieobecności: kalendarz, wnioski, salda i zastępstwa.
5. Zadania emisji: wydarzenia, kompetencje i punkty.
6. Walidacja: konkretna osoba, daty, reguła, wartości, podstawa i proponowana naprawa.
7. Ustawienia i historia wersji.

Wykresy wymagane:

| Wykres | Co pokazuje |
|---|---|
| Słupki godzin na osobę | Wymiar, plan, wykonanie i nieobecności jako odrębne serie |
| Mapa cieplna obsady | Wymagane i dostępne osoby w przedziałach czasu; kliknięcie otwiera lukę |
| Słupki obciążenia | Punkty łącznie i punkty na godzinę, z filtrem zadań |
| Rozkład zmian | Noce, weekendy, święta i zmiany długie na osobę |
| Linia salda okresu | Narastająco plan lub wykonanie wobec wymiaru i prognozy |
| Nieobecności | Godziny U, UŻ, CH oraz dni CH i UŻ w oddzielnych jednostkach |

Każdy wykres ma legendę, okres, jednostkę, tabelę danych i filtr plan/wykonanie. Kolor nie jest jedynym nośnikiem informacji. Żaden wykres nie przedstawia urlopu lub choroby jako wykonanej pracy.

## 9. Proces i automatyczne propozycje

Konfiguracja → zapotrzebowanie → nieobecności → ręczny plan → walidacja → korekty → zatwierdzenie → udostępnienie → wykonanie i rozliczenie. Harmonogram obejmuje co najmniej miesiąc i jest przekazywany co najmniej tydzień przed rozpoczęciem objętego nim okresu, z uwzględnieniem właściwych wyjątków ustawowych. Zmiany po publikacji wymagają powodu i zachowania poprzedniej wersji; nie wolno poprawiać historii w celu ukrycia nadgodzin.

W MVP system podpowiada dostępne osoby do zastępstwa. W etapie drugim generator respektuje twarde ograniczenia: prawo, nieobecności, kompetencje, obsada i zablokowane wpisy. Następnie optymalizuje preferencje, rozkład nocy/weekendów i punkty obciążenia. Przy braku rozwiązania pokazuje brakujące osobogodziny i przyczyny. Nie wolno po cichu łamać reguł ani tworzyć siódmego pracownika.

Bilans zespołu musi uwzględniać także inne obowiązki służbowe: zapotrzebowanie na same sloty emisji może być mniejsze niż suma etatów. System nie wstawia fikcyjnych zmian, aby „domknąć” etat; wskazuje potrzebę przypisania rzeczywistych zadań lub decyzji organizacyjnej.

## 10. Model danych i obliczenia

Encje: pracownik, profil prawny, okres rozliczeniowy, kalendarz świąt, szablon slotu, zapotrzebowanie stanowiska, wersja grafiku, przydział zmiany, wykonanie pracy, nieobecność, saldo urlopu, należność dnia wolnego, rekompensata, kompetencja, zadanie, przydział zadania, wynik walidacji i log audytu.

Wszystkie czasy liczone w minutach, wyświetlane w godzinach i minutach; bez zaokrąglania pojedynczych zmian do pełnych godzin. Każda zmiana ma identyfikator i wersję. Dane planu i wykonania są oddzielne.

Wymiar skorygowany = wymiar bazowy − planowe godziny usprawiedliwionych nieobecności. Saldo wykonania = godziny faktyczne − wymiar skorygowany; nie jest ono samo w sobie wyliczeniem nadgodzin. Pokrycie = obsadzone wymagane osobogodziny / wymagane osobogodziny. Nadmiar obsady raportowany osobno, nie zwiększa pokrycia powyżej 100%.

## 11. Błędy ostrzeżenia i zatwierdzanie

Błąd blokujący plan: nakładające się przydziały osoby, naruszenie odpoczynku, przekroczenie dopuszczalnej planowej długości, praca podczas potwierdzonej nieobecności lub naruszenie ograniczenia indywidualnego. Szkic można zachować z błędami, zatwierdzonego planu nie można opublikować z nierozwiązanym błędem prawnym.

Ostrzeżenia operacyjne: luka obsady, brak kompetencji, nierównomierne obciążenie, preferencja niespełniona, niepełne dane sąsiednich okresów. Luka wymaga jawnej decyzji kierownika; plan z niepełną walidacją nie może otrzymać etykiety „zgodny”. Ustawowy wyjątek to odrębna reguła z dokumentacją, a nie przycisk „ignoruj prawo”. Nieprawidłowe wykonanie da się zapisać i skierować do kadr.

## 12. Wymagania techniczne i bezpieczeństwo

Responsywny interfejs w języku polskim, wygodny przede wszystkim na komputerze. Trwała baza danych, kontrola ról, log zmian, kopie zapasowe, przywracanie i ochrona przed nadpisaniem przez równoczesną edycję. Walidacja po zmianie pojedynczego wpisu dla sześciu osób i miesiąca powinna kończyć się w ciągu 2 sekund w uzgodnionym środowisku. Syntetyczne dane w testach i demonstracji.

Eksport XLSX: grafik, legenda, podsumowania, nieobecności zgodnie z rolą odbiorcy i raport walidacji. Eksport PDF: czytelny grafik do udostępnienia. Import XLSX z podglądem mapowania i błędów, bez automatycznej publikacji. Dane urlopów i chorób nie mogą znajdować się w publicznym widoku ani publicznym linku. Integracje SharePoint, system kadrowy i kalendarz sportowy w późniejszym etapie.

## 13. Kryteria akceptacji

| Test | Oczekiwany wynik |
|---|---|
| Październik 2026, pełny etat, miesiąc | Wymiar 176 h; dla sześciu osób 1056 h przed nieobecnościami |
| Listopad 2026 | 160 h dla pełnego etatu; święto w niedzielę nie obniża wymiaru dodatkowo |
| P do 23:00 i R następnego dnia od 07:00 | 8 h odpoczynku; blokada zatwierdzenia |
| Dwie zmiany bez nakładania, ale w tej samej dobie pracowniczej | Kontrola doby, nie tylko odstępu między zmianami |
| Planowa zmiana 12 h | Brak automatycznych 4 h nadgodzin; sprawdzenie bilansu okresu |
| Własna planowa zmiana 13 h | Odrzucona dla standardowego profilu projektu |
| U na zmianie 10 h | Praca faktyczna 0 h, urlop 10 h, pula mniejsza o 10 h |
| UŻ na zmianie 12 h | Pula mniejsza o 12 h i wykorzystany jeden dzień UŻ |
| Piąty dzień UŻ | Alert przekroczenia uprawnienia i brak zatwierdzenia jako UŻ |
| CH obejmuje zmianę 12 h i dzień wolny | Dni kalendarzowe CH oddzielnie; wymiar obniżony o 12 h, nie 20 h |
| Choroba po publikacji | Pierwotna zmiana pozostaje w historii; system szuka zastępstwa |
| Brak danych poprzedniego miesiąca | Status niepełnej walidacji |
| Zmiana podczas zmiany czasu | Rzeczywisty czas poprawny, różny od samej różnicy godzin na zegarze |
| Za mało sześciu osób po nieobecnościach | Jawny raport niedoboru; brak nielegalnej propozycji |
| Zmiana wagi zadania | Punkty przeliczone; godziny pracy i limity prawne niezmienione |

Przed odbiorem kadry zatwierdzają dodatkowe testy: koniec okresu, nadgodziny bez podwójnego liczenia, niedziele, święta, szczególne uprawnienia oraz urlop kolidujący z chorobą.

## 14. Etapy i decyzje wdrożeniowe

MVP: ręczny grafik, sześć osób, sloty własne, konfiguracja okresu, nieobecności, walidacja, liczniki, zadania i wykresy, zatwierdzanie, eksport i historia. Etap drugi: generator, zamiany pracownicze, import i scenariusze absencji. Etap trzeci: integracje, więcej zespołów i dane rozliczeniowe dla kadr.

Business Owner odpowiada za zapotrzebowanie, definicję obciążenia i akceptację użytkową. Technical Owner za implementację, integralność danych i testy. Kadry zatwierdzają zakładowy profil prawny. Wspólny odbiór na rzeczywistym miesiącu porównanym z obecnym procesem.

Do ustalenia przed konfiguracją produkcji: faktyczny okres rozliczeniowy i dokument jego wprowadzenia, pora nocna i granica niedzieli/święta, zasady zmian opublikowanego grafiku, salda i ograniczenia pracowników, obsada świąt, potrzeba pokrycia 06:00–07:00, czas przekazania oraz realne zadania poza slotami emisji. Nie blokuje to budowy prototypu na danych testowych.

## 15. Źródła prawne i zakres weryfikacji

Sprawdzenie źródeł publicznych: 12 października 2026. Reguły wdrożenia wymagają przypisania dokładnych artykułów oraz weryfikacji dokumentów pracodawcy; PRD nie zastępuje regulaminu pracy ani zatwierdzenia kadrowego.

- Kodeks pracy, tekst ujednolicony ISAP: https://isap.sejm.gov.pl/isap.nsf/download.xsp/WDU20250000277/U/D20250277Lj.pdf
- MRPiPS, Ustalanie czasu pracy: https://www.gov.pl/web/rodzina/ustalanie-i-rozliczanie-czasu-pracy
- PIP, Czas pracy: https://www.pip.gov.pl/dla-pracownikow/porady-prawne/czas-pracy
- MRPiPS, Urlopy i zwolnienia od pracy: https://www.gov.pl/web/rodzina/urlopy-i-zwolnienia-od-pracy
- PIP, Odpoczynek rzecz święta Urlopy wypoczynkowe od A do Z: https://www.pip.gov.pl/aktualnosci/odpoczynek-rzecz-swieta-urlopy-wypoczynkowe-od-a-do-z?tmpl=pdf
- OIP Katowice, Jak zrekompensować pracownikowi pracę w niedzielę lub święto: https://katowice.pip.gov.pl/aktualnosci/jak-zrekompensowac-pracownikowi-prace-w-niedziele-lub-swieto?tmpl=print
- OIP Gdańsk, Dzień wolny z tytułu święta przypadającego w sobotę: https://gdansk.pip.gov.pl/aktualnosci/dzien-wolny-z-tytulu-swieta-przypadajacego-w-sobote-wyjasniamy?tmpl=print
