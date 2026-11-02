import mn.gostore.warehouse.NavigationPolicy;

public class NavigationPolicyTest {
    private static void check(boolean value) { if (!value) throw new AssertionError(); }
    public static void main(String[] args) {
        check(NavigationPolicy.warehousePage(NavigationPolicy.HOME));
        check(NavigationPolicy.warehousePage("https://gostore.mn:443/warehouse/index.html?location=erenhot"));
        for (String url : new String[]{"http://gostore.mn/warehouse/", "https://gostore.mn.evil.test/warehouse/", "https://gostore.mn@evil.test/warehouse/", "https://evil.test@gostore.mn/warehouse/", "https://gostore.mn:8443/warehouse/", "file:///warehouse/", "javascript:alert(1)", "https://gostore.mn/admin/", "https://gostore.mn/warehouse/../admin/", "https://gostore.mn/warehouse/%2e%2e/admin/"}) check(!NavigationPolicy.warehousePage(url));
        check(NavigationPolicy.photoPage("https://gostore.mn/api/index.php?action=warehouse-photo&id=GS-TEST"));
        check(!NavigationPolicy.photoPage("https://gostore.mn/api/index.php?action=warehouse-logout"));
        check(!NavigationPolicy.photoPage("https://evil.test/api/index.php?action=warehouse-photo"));
        System.out.println("PASS navigation origin, credentials, ports, paths, photo restrictions");
    }
}
