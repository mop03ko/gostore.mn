# GOStore Эрээн агуулах — Android

Хятад хэлтэй агуулахын панелийг Android дээр нээдэг, шууд APK файлаар суулгах тусдаа апп. Google Play эсвэл бусад дэлгүүрт нийтлэхгүй. Хэрэглэгчийн `gostoremn/` Expo апптай тусдаа package, signing key ашиглана.

- Package: `mn.gostore.warehouse`
- Version: `1.0.0` / versionCode `1`
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

`D:\Gostore.mn\output\android\GOStore-Erenhot-1.0.0.apk`

APK-д API түлхүүр, менежерийн нууц үг, signing key ороогүй. Серверийн session, CSRF болон эрхийн шалгалтууд хэвээр үйлчилнэ. HTTPS, зөвхөн `gostore.mn` эх үүсвэрийн нөөц ашиглана. Бусад HTTPS холбоосыг хэрэглэгч дарсан үед гаднах браузерт нээнэ. TLS алдааг алгасахгүй, native JavaScript interface ашиглахгүй. Аппын өгөгдлийг Android backup-д оруулахгүй.

## Дахин build хийх

Windows PowerShell дээр:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File warehouse-android/build.ps1
```

Build нь JDK 17, Android platform 35, build-tools 35.0.0 ашигладаг. Gradle, Node эсвэл Expo шаардлагагүй. Default tool root: `tmp/tooling/android`; өөр замыг `-ToolRoot` параметрээр өгч болно. ZIP-үүдийг дараах дэд хавтсуудад задлана:

| Дэд хавтас | Албан ёсны татах файл | Баталгаажуулах hash |
| --- | --- | --- |
| `jdk/` | [Temurin JDK 17.0.20.1+1 Windows x64](https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.20.1%2B1/OpenJDK17U-jdk_x64_windows_hotspot_17.0.20.1_1.zip) | SHA256 `e53a79c3c3d86865bd7e787903884331068e71321714ffd44f145785affc7cb0` |
| `platform/` | [Android platform 35 r02](https://dl.google.com/android/repository/platform-35_r02.zip) | SHA1 `0bb560a90a7a2cbd0dd8348224d518b638fe7949` |
| `build-tools/` | [Android build-tools 35](https://dl.google.com/android/repository/build-tools_r35_windows.zip) | SHA1 `af059bb67cf7786f45ee0db85e2d24985df1b4b6` |

Build бүр тусдаа түр хавтас үүсгэнэ. URL-ийн аюулгүй байдлын Java тест, compile, DEX, alignment, signing болон signature verification ажиллуулж, `output/android/` дотор APK, SHA256, суулгах заавар гаргана. Icon нь одоогийн `assets/favicon.svg`-ээс хөрвүүлсэн GOStore тэмдэг.

Эхний build дээр `signing/warehouse-release.p12`, `signing/keystore-password.txt` үүснэ. Энэ хавтасны ACL-ийг тухайн Windows хэрэглэгчээр хязгаарлана. **Хоёр файлыг хамгаалалттай газар нөөцөлж хадгал.** Шинэ APK-г хуучин апп дээр update байдлаар суулгахын тулд ижил key заавал хэрэгтэй. Эдгээрийг Git, APK, татах хавтас эсвэл менежер рүү явуулахгүй.

Дараагийн хувилбарт manifest-ийн versionCode-ийг өсгөж, versionName, Activity user agent болон build output нэрийг хамт шинэчилнэ. Нэг key/password алга болсон тохиолдолд script key-г чимээгүй солихгүй, алдаа өгнө.

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
