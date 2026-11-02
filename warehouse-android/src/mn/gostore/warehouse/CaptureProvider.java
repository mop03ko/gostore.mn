package mn.gostore.warehouse;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Only shares randomly named camera JPEGs, never the app's other private files. */
public final class CaptureProvider extends ContentProvider {
    public static final String AUTHORITY = "mn.gostore.warehouse.capture";
    private File resolve(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (!AUTHORITY.equals(uri.getAuthority()) || uri.getPathSegments().size() != 1
                || name == null || !name.matches("[a-f0-9]{32}\\.jpg")) throw new FileNotFoundException();
        return new File(new File(getContext().getCacheDir(), "camera"), name);
    }
    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri uri) { return "image/jpeg"; }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = resolve(uri);
        if (!file.exists()) throw new FileNotFoundException();
        if (!mode.equals("r") && !mode.equals("w") && !mode.equals("rw") && !mode.equals("wt") && !mode.equals("rwt")) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.parseMode(mode));
    }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String order) {
        try {
            File file = resolve(uri);
            MatrixCursor result = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
            result.addRow(new Object[]{file.getName(), file.length()}); return result;
        } catch (FileNotFoundException e) { return null; }
    }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String s, String[] a) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String s, String[] a) { throw new UnsupportedOperationException(); }
}
