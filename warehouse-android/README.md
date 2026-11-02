# GOStore Эрээн агуулах — Android

Хятад хэлтэй агуулахын панелийг Android дээр нээдэг, шууд APK файлаар суулгах тусдаа апп. Google Play эсвэл бусад дэлгүүрт нийтлэхгүй. Хэрэглэгчийн `gostoremn/` Expo апптай тусдаа package, signing key ашиглана.

- Package: `mn.gostore.warehouse`
- Version: `1.1.0` / versionCode `2`
- Android 8.0+ (API 26), target API 35
- Үндсэн хуудас: `https://gostore.mn/warehouse/?location=erenhot`
- Нэвтрэх эрх: админд үүсгэсэн одоогийн агуулахын менежерийн эрх
- Интернэт болон шинэчлэгдсэн Android System WebView шаардлагатай.

## Ажиллагаа

Одоогийн панелийн захиалга хайх, зурагтай хүлээн авах, хэмжилт бүртгэх, багц үүсгэх, QR унших, илгээснийг гараар батлах ажиллагааг ашиглана. Камерын эрхийг зураг авах эсвэл QR уншуулах үед хүснэ. Галерейгаас зураг сонгох боломжтой. Апп Эрээн агуулахыг анх сонгоно; бодит агуулахын эрхийг сервер шалгана.

QR унших нь багцыг нээнэ; хүлээн авсан эсвэл илгээсэн төлөвийг автоматаар батлахгүй. Интернэт тасарсан үед өөрчлөлтийг дараа илгээхээр хадгалахгүй. Хүсэлт тасарвал төлөвийг дахин шалгаад үргэлжлүүлнэ.

Хэвлэх товч Android-ийн хэвлэх цонх нээнэ. Багцын шошго 100 × 150 мм, багцын дэлгэрэнгүй жагсаалт A4. PDF болгон хадгалах эсвэл тухайн хэвлэгчийг дэмждэг Android print service ашиглана. XP-420B руу шууд USB/Bluetooth команд илгээх драйвер агуулаагүй. Бодит хэвлэгч дээр хэмжээ, ирмэг болон QR уншилтыг эхлээд турших шаардлагатай.

## Суулгах

`INSTALL.txt`-ийн зааврыг APK-тай хамт менежерт өгнө. Бүтээсэн файл:

`D:\Gostore.mn\output\android\GOStore-Erenhot-1.1.0.apk`

APK-д серверийн нууц түлхүүр, менежерийн нууц үг, signing key ороогүй. Firebase-ийн нийтэд зориулсан Android client тохиргоо багтана. Серверийн session, CSRF болон эрхийн шалгалтууд хэвээр үйлчилнэ. WebView зөвхөн `gostore.mn` эх үүсвэрийн нөөц ашиглана; native push Firebase-тэй HTTPS-ээр холбогдоно. Бусад HTTPS холбоосыг хэрэглэгч дарсан үед гаднах браузерт нээнэ. TLS алдааг алгасахгүй, native JavaScript interface ашиглахгүй. Аппын өгөгдлийг Android backup-д оруулахгүй.

## Push мэдэгдэл

Нэвтэрсний дараа **开启推送通知 / Push мэдэгдэл идэвхжүүлэх** дарж Android-ийн мэдэгдлийн эрхийг зөвшөөрнө. **测试推送 / Push турших** нь захиалга үүсгэхгүйгээр серверээс тухайн утсанд туршилтын мэдэгдэл илгээнэ. Google Play services болон Firebase-д хүрэх сүлжээ шаардлагатай. Төхөөрөмж бүр дээр тусад нь идэвхжүүлнэ.

FCM зөвхөн сэрээх дохио дамжуулна; апп захиалгын кодыг GOStore-оос агуулахын эрхээр авна. Мэдэгдэл дарахад тухайн захиалга нээгдэнэ. Logout болон менежерийн эрх цуцлагдахад төхөөрөмжийн эрх хүчингүй болно. Серверийн холболт, автомат тестүүд шалгагдсан; бодит утас дээрх хүлээн авалтыг суулгасны дараа туршина.

## Дахин build хийх

Windows PowerShell дээр:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File warehouse-android/build.ps1
```

Build нь JDK 17, Android platform 35, build-tools 35.0.0, Gradle 8.11.1 ашигладаг. Script Gradle-ийг албан ёсны эх үүсвэрээс татаж SHA256 шалгана. Firebase Android client тохиргоог `warehouse-android/google-services.json` файлд байрлуулна (Git-ignored). Node эсвэл Expo шаардлагагүй. Default tool root: `tmp/tooling/android`; өөр замыг `-ToolRoot` параметрээр өгч болно. ZIP-үүдийг дараах дэд хавтсуудад задлана:

| Дэд хавтас | Албан ёсны татах файл | Баталгаажуулах hash |
| --- | --- | --- |
| `jdk/` | [Temurin JDK 17.0.20.1+1 Windows x64](https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip) | SHA256 `e53a79c3c3d86865bd7e787903884331068e71321714ffd44f145785affc7cb0` |
| `platform/` | [Android platform 35 r02](https://dl.google.com/android/repository/platform-35_r02.zip) | SHA1 `0bb560a90a7a2cbd0dd8348224d518b638fe7949` |
| `build-tools/` | [Android build-tools 35](https://dl.google.com/android/repository/build-tools_r35_windows.zip) | SHA1 `af059bb67cf7786f45ee0db85e2d24985df1b4b6` |

Build нь URL-ийн Java тест, Robolectric push тест, Android lint, compile, alignment, signing болон signature verification ажиллуулж, `output/android/` дотор APK, SHA256, суулгах заавар гаргана. Gradle build/cache файлууд Git-д орохгүй. Icon нь одоогийн `assets/favicon.svg`-ээс хөрвүүлсэн GOStore тэмдэг.

Өмнөх хувилбарын `signing/warehouse-release.p12`, `signing/keystore-password.txt` файлууд шаардлагатай. Энэ хавтасны ACL тухайн Windows хэрэглэгчээр хязгаарлагдсан. **Хоёр файлыг хамгаалалттай газар нөөцөлж хадгал.** Шинэ APK-г хуучин апп дээр update байдлаар суулгахын тулд ижил key заавал хэрэгтэй. Эдгээрийг Git, APK, татах хавтас эсвэл менежер рүү явуулахгүй.

Дараагийн хувилбарт `build.gradle`-ийн versionCode-ийг өсгөж, versionName, Activity user agent болон build output нэрийг хамт шинэчилнэ. Нэг key/password алга болсон тохиолдолд script key-г чимээгүй солихгүй, алдаа өгнө.

## Шалгалт

```powershell
.\tmp\tooling\node.exe tests/run-logistics.cjs warehouse warehouse-batches logistics logistics-ui
```

Серверийн тестүүд тусгаарласан local database ашигладаг. UI тестүүд браузерт ажиллана; бодит Android камер, permission цонх, native хэвлэх үйлдлийг орлохгүй.

Гар утсаар хүлээн авах туршилт:

1. APK суулгах, хятад login харах, Эрээн менежерээр нэвтрэх.
2. Туршилтын захиалга нээж камерын зөвшөөрөл өгөх/татгалзах, зураг авах/цуцлах, галерейгаас оруулах.
3. Багцын QR унших, камераас буцах, аппыг background/foreground болгох.
4. Багцлах → бэлэн болгох → гараар илгээснийг батлах, хэрэглэгчийн tracking-тай тулгах.
5. Шошгыг PDF болон дэмжигдсэн хэвлэгчээр 100 × 150 мм хэвлэх, QR-ийг дахин унших.
6. Сүлжээ таслах/сэргээх, logout, ижил key-тэй дараагийн APK-г update байдлаар суулгах.

Эхний build дээр холбогдсон Android төхөөрөмж байгаагүй: утас болон бодит хэвлэгчийн туршилт хийгдээгүй.
