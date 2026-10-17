# Minløn

Lønberegner for daghold — PWA statică, offline-first, fără backend. Toate tarifele și datele
fiscale se introduc în Setări și stau doar în localStorage; nicio sumă personală în cod.

- Build: `bash build.sh` → `dist/` (Cloudflare Pages: output `dist`). Limbi: DA/EN/RO, toate
  textele în `I18N` din `app.js`.
- Calculul e validat la øre pe două lønsedler reale (net 10.398,09 și 11.314,12 kr); orice
  schimbare în `calculatePay` trebuie să le reproducă în continuare.

## Donație (MobilePay)

- Link: https://qr.mobilepay.dk/vp/KJjvd-Rnp — MobilePay business EANmatch #122921. Deschide
  aplicația MobilePay pe iOS și Android. Folosit în panoul de la finalul Setărilor
  (`target="_blank" rel="noopener"`), plus o notă în secțiunea Privatliv.
- NU folosi vechiul link MobilePay Box: afișa numele și telefonul owner-ului.
