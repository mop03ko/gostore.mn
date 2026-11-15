package mn.gostore.warehouse;

import android.graphics.Color;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.SystemClock;
import android.view.*;
import android.widget.*;
import androidx.activity.ComponentActivity;
import androidx.camera.core.*;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import com.google.mlkit.vision.barcode.*;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.common.InputImage;
import java.util.concurrent.Executor;

/** Bundled offline decoder. Camera frames never leave the device. */
final class NativeScanner {
    interface Listener { void code(String value); void close(); void fallback(); }
    private final ComponentActivity owner;
    private final Listener listener;
    private final Executor main;
    private FrameLayout root;
    private PreviewView preview;
    private ScanBox highlight;
    private TextView status;
    private Button torch,mode;
    private SeekBar zoom;
    private Camera camera;
    private ProcessCameraProvider provider;
    private ImageAnalysis analysis;
    private BarcodeScanner decoder;
    private boolean closed,busy,waiting,light,qrOnly;
    private String last="";
    private long lastAt;
    private ToneGenerator tone;
    NativeScanner(ComponentActivity activity,Listener callback){owner=activity;listener=callback;main=ContextCompat.getMainExecutor(owner);}
    private int dp(int n){return (int)(n*owner.getResources().getDisplayMetrics().density+.5f);}
    private Button button(String text,LinearLayout row,Runnable action){Button b=new Button(owner);b.setText(text);row.addView(b,new LinearLayout.LayoutParams(0,dp(52),1));b.setOnClickListener(v->action.run());return b;}
    void open(){
        root=new FrameLayout(owner);root.setBackgroundColor(Color.rgb(19,35,68));
        root.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        LinearLayout layout=new LinearLayout(owner);layout.setOrientation(LinearLayout.VERTICAL);root.addView(layout,new FrameLayout.LayoutParams(-1,-1));
        LinearLayout bar=new LinearLayout(owner);layout.addView(bar);
        button("关闭",bar,()->listener.close());torch=button("开灯",bar,()->{if(camera!=null&&camera.getCameraInfo().hasFlashUnit()){light=!light;camera.getCameraControl().enableTorch(light);torch.setText(light?"关灯":"开灯");}});torch.setEnabled(false);
        mode=button("QR + 条码",bar,()->{qrOnly=!qrOnly;mode.setText(qrOnly?"仅 QR":"QR + 条码");configureDecoder();});
        LinearLayout fallbackBar=new LinearLayout(owner);layout.addView(fallbackBar);button("网页相机 / 选择照片",fallbackBar,()->listener.fallback());
        FrameLayout viewfinder=new FrameLayout(owner);layout.addView(viewfinder,new LinearLayout.LayoutParams(-1,0,1));
        preview=new PreviewView(owner);preview.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);preview.setScaleType(PreviewView.ScaleType.FIT_CENTER);viewfinder.addView(preview,new FrameLayout.LayoutParams(-1,-1));
        highlight=new ScanBox(owner);viewfinder.addView(highlight,new FrameLayout.LayoutParams(-1,-1));
        preview.setOnTouchListener((v,event)->{if(event.getAction()==MotionEvent.ACTION_UP&&camera!=null){v.performClick();camera.getCameraControl().startFocusAndMetering(new FocusMeteringAction.Builder(preview.getMeteringPointFactory().createPoint(event.getX(),event.getY())).build());}return true;});
        status=new TextView(owner);status.setTextColor(Color.WHITE);status.setTextSize(17);status.setGravity(Gravity.CENTER);status.setPadding(dp(16),dp(12),dp(16),dp(12));status.setText("对准二维码或快递条码 · 点击画面对焦");layout.addView(status);
        TextView hint=new TextView(owner);hint.setText("缩放：滑动调节 · 扫码只识别，不自动确认收发货");hint.setTextColor(Color.WHITE);hint.setGravity(Gravity.CENTER);layout.addView(hint);
        zoom=new SeekBar(owner);zoom.setMax(100);zoom.setEnabled(false);layout.addView(zoom,new LinearLayout.LayoutParams(-1,dp(52)));
        zoom.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar s){}public void onStopTrackingTouch(SeekBar s){}public void onProgressChanged(SeekBar s,int n,boolean user){if(user&&camera!=null)camera.getCameraControl().setZoomRatio(1+(maxZoom()-1)*n/100f);}});
        owner.addContentView(root,new ViewGroup.LayoutParams(-1,-1));root.requestApplyInsets();
        try{tone=new ToneGenerator(AudioManager.STREAM_NOTIFICATION,65);}catch(RuntimeException ignored){}
        configureDecoder();
        com.google.common.util.concurrent.ListenableFuture<ProcessCameraProvider> future=ProcessCameraProvider.getInstance(owner);
        future.addListener(()->{if(closed)return;try{
            provider=future.get();Preview p=new Preview.Builder().build();p.setSurfaceProvider(preview.getSurfaceProvider());
            analysis=new ImageAnalysis.Builder().setTargetResolution(new android.util.Size(1280,720)).setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build();
            analysis.setAnalyzer(main,this::analyze);camera=provider.bindToLifecycle(owner,CameraSelector.DEFAULT_BACK_CAMERA,p,analysis);
            torch.setEnabled(camera.getCameraInfo().hasFlashUnit());zoom.setEnabled(maxZoom()>1);
            configureDecoder();camera.getCameraInfo().getZoomState().observe(owner,state->{if(!closed&&state!=null)zoom.setProgress(Math.round((state.getZoomRatio()-1)/Math.max(.01f,maxZoom()-1)*100));});
        }catch(Exception e){status.setText("相机无法启动。请关闭后使用网页相机或选择照片。");}},main);
    }
    private float maxZoom(){ZoomState z=camera==null?null:camera.getCameraInfo().getZoomState().getValue();return z==null?1:Math.min(4,z.getMaxZoomRatio());}
    private void configureDecoder(){
        if(closed)return;
        BarcodeScannerOptions.Builder options=new BarcodeScannerOptions.Builder();
        if(qrOnly)options.setBarcodeFormats(Barcode.FORMAT_QR_CODE);
        else options.setBarcodeFormats(Barcode.FORMAT_QR_CODE,Barcode.FORMAT_CODE_128,Barcode.FORMAT_CODE_39,Barcode.FORMAT_ITF,Barcode.FORMAT_CODABAR,Barcode.FORMAT_EAN_13,Barcode.FORMAT_EAN_8,Barcode.FORMAT_UPC_A);
        options.setZoomSuggestionOptions(new ZoomSuggestionOptions.Builder(ratio->{if(closed||camera==null)return false;camera.getCameraControl().setZoomRatio(Math.max(1,Math.min(maxZoom(),ratio)));return true;}).setMaxSupportedZoomRatio(maxZoom()).build());
        BarcodeScanner old=decoder;decoder=BarcodeScanning.getClient(options.build());if(old!=null)old.close();
    }
    @androidx.annotation.OptIn(markerClass = androidx.camera.core.ExperimentalGetImage.class)
    private void analyze(ImageProxy frame){
        if(closed||busy||waiting||frame.getImage()==null){frame.close();return;}
        busy=true;BarcodeScanner current=decoder;mode.setEnabled(false);
        current.process(InputImage.fromMediaImage(frame.getImage(),frame.getImageInfo().getRotationDegrees())).addOnSuccessListener(main,codes->{
            if(closed||waiting)return;
            // One code per frame avoids accidental multi-item actions. Prefer the centre label.
            codes=new java.util.ArrayList<>(codes);codes.sort((a,b)->Double.compare(distance(a,frame),distance(b,frame)));
            for(Barcode code:codes){String value=ScanPolicy.normalize(code.getRawValue());if(value==null)continue;
                long now=SystemClock.elapsedRealtime();if(value.equals(last)&&now-lastAt<3000)continue;
                last=value;lastAt=now;waiting=true;status.setText("已识别："+value+"\n正在查询…");
                boolean rotated=frame.getImageInfo().getRotationDegrees()%180!=0;highlight.show(code.getBoundingBox(),rotated?frame.getHeight():frame.getWidth(),rotated?frame.getWidth():frame.getHeight());
                status.setTextColor(Color.rgb(120,240,170));root.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                if(tone!=null)tone.startTone(ToneGenerator.TONE_PROP_BEEP,120);
                listener.code(value);break;
            }
        }).addOnFailureListener(main,e->{if(!closed)status.setText("暂时未识别，请调整距离、对焦或打开灯光");}).addOnCompleteListener(main,t->{frame.close();busy=false;if(!closed)mode.setEnabled(true);});
    }
    private double distance(Barcode code,ImageProxy frame){android.graphics.Rect r=code.getBoundingBox();if(r==null)return Double.MAX_VALUE;boolean rotated=frame.getImageInfo().getRotationDegrees()%180!=0;double x=r.exactCenterX()-(rotated?frame.getHeight():frame.getWidth())/2.0,y=r.exactCenterY()-(rotated?frame.getWidth():frame.getHeight())/2.0;return x*x+y*y;}
    void result(String text){if(closed)return;status.setText(text);root.postDelayed(()->{if(!closed){waiting=false;status.setTextColor(Color.WHITE);}},900);}
    void close(){if(closed)return;closed=true;if(camera!=null){camera.getCameraControl().enableTorch(false);camera.getCameraInfo().getZoomState().removeObservers(owner);}if(analysis!=null)analysis.clearAnalyzer();if(provider!=null)provider.unbindAll();if(decoder!=null)decoder.close();if(tone!=null)tone.release();if(root!=null&&root.getParent()!=null)((ViewGroup)root.getParent()).removeView(root);}
    private static final class ScanBox extends View {
        private android.graphics.Rect box;private int width,height;private final android.graphics.Paint paint=new android.graphics.Paint(3);
        ScanBox(android.content.Context c){super(c);paint.setColor(Color.rgb(120,240,170));paint.setStyle(android.graphics.Paint.Style.STROKE);paint.setStrokeWidth(4*c.getResources().getDisplayMetrics().density);}
        void show(android.graphics.Rect b,int w,int h){box=b==null?null:new android.graphics.Rect(b);width=w;height=h;invalidate();postDelayed(()->{box=null;invalidate();},900);}
        @Override protected void onDraw(android.graphics.Canvas canvas){super.onDraw(canvas);if(box==null||width==0||height==0)return;float scale=Math.min(getWidth()/(float)width,getHeight()/(float)height),x=(getWidth()-width*scale)/2,y=(getHeight()-height*scale)/2;canvas.drawRoundRect(new android.graphics.RectF(x+box.left*scale,y+box.top*scale,x+box.right*scale,y+box.bottom*scale),12,12,paint);}
    }
}
