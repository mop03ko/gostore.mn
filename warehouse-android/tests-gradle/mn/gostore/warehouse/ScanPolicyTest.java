package mn.gostore.warehouse;
import org.junit.Test;
import static org.junit.Assert.*;
public class ScanPolicyTest {
    @Test public void warehouseAndCarrierCodes(){assertEquals("GB-ABC123",ScanPolicy.normalize(" gb-abc123 "));assertEquals("SF001234567890",ScanPolicy.normalize("SF001234567890"));}
    @Test public void rejectExecutableAndOversizedPayloads(){for(String value:new String[]{"https://gostore.mn/warehouse/","javascript:alert(1)","GS-\";alert(1)","1","你好",new String(new char[101]).replace('\0','A')})assertNull(value,ScanPolicy.normalize(value));assertNull(ScanPolicy.normalize(null));}
}
