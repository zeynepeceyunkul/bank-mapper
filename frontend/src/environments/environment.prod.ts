// Production build'de environment.ts yerine bu dosya kullanılır (bkz.
// angular.json -> architect.build.configurations.production.fileReplacements).
// Backend Cloud Run'a deploy edildikten sonra oradan alınan gerçek URL
// (https://xxxx-uc.a.run.app/api gibi) buraya yazılmalı - deploy rehberindeki
// sıra: önce backend deploy et, URL'i al, burayı güncelle, SONRA frontend'i
// build edip Firebase Hosting'e deploy et.
export const environment = {
  apiUrl: 'https://bank-mapper-api-1010933862195.europe-west1.run.app/api',
};
