package mn.gostore.warehouse;

import java.net.URI;

/** Independent of Android so hostile URL cases can be tested on the build host. */
public final class NavigationPolicy {
    public static final String HOME = "https://gostore.mn/warehouse/?location=erenhot";
    public static boolean trustedOrigin(String value) {
        try {
            URI uri = new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && "gostore.mn".equalsIgnoreCase(uri.getHost())
                && uri.getRawUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
        } catch (Exception ignored) { return false; }
    }
    public static boolean warehousePage(String value) {
        if (!trustedOrigin(value)) return false;
        String path = URI.create(value).getPath();
        return "/warehouse/".equals(path) || "/warehouse/index.html".equals(path);
    }
    public static boolean photoPage(String value) {
        if (!trustedOrigin(value)) return false;
        URI uri = URI.create(value);
        if (!"/api/index.php".equals(uri.getPath()) || uri.getRawQuery() == null) return false;
        for (String field : uri.getRawQuery().split("&"))
            if (field.equals("action=warehouse-photo") || field.equals("action=warehouse-exception-photo")) return true;
        return false;
    }
    private NavigationPolicy() {}
}
