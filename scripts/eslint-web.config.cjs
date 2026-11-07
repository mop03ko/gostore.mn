'use strict';
// ESLint for the build-free web code (storefront sources, admin, warehouse); run by CI with
// `eslint -c scripts/eslint-web.config.cjs .`. Source files get the recommended correctness rules.
// Files share globals at runtime, so per-file no-undef is off; instead the concatenated app.js is
// checked for undefined names, which catches misspelt cross-file functions.
const path=require('node:path');
const load=name=>{try{return require(name);}catch{return require(path.join(__dirname,'..','gostoremn','node_modules',name));}};
const js=load('@eslint/js'),globals=load('globals');
// Objects modules publish on window (window.customerAccount=…) and use by bare name elsewhere.
const appGlobals=Object.fromEntries(['customerAccount','storeServer','commerceUI','taobaoCart','supplierApi','GOStoreCargo','syncMobileNav','OrderTracking','accountPage','module'].map(n=>[n,'readonly']));
module.exports=[
  {ignores:['assets/vendor/**','gostoremn/**','staff-ios/**','warehouse-android/**','tests/**','scripts/**','tmp/**','output/**','poster/**','**/node_modules/**']},
  {files:['**/*.js'],ignores:['app.js'],languageOptions:{ecmaVersion:2024,sourceType:'script'},
    rules:{...js.configs.recommended.rules,'no-undef':'off','no-unused-vars':'off','no-empty':'off','no-redeclare':'off'}},
  {files:['app.js'],languageOptions:{ecmaVersion:2024,sourceType:'script',globals:{...globals.browser,...appGlobals}},rules:{'no-undef':'error'}},
];
