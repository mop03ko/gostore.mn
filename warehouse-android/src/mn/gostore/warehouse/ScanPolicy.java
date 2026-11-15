package mn.gostore.warehouse;

/** Codes only: never open arbitrary URLs or execute QR payloads. */
final class ScanPolicy {
    static String normalize(String raw){
        if(raw==null||raw.length()>100)return null;
        String value=raw.trim().toUpperCase(java.util.Locale.ROOT);
        return value.matches("[A-Z0-9-]{4,50}")?value:null;
    }
}
