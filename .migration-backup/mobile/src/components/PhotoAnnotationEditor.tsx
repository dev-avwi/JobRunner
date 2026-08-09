import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../lib/theme';
import { colors as staticColors } from '../lib/colors';
import { spacing, radius } from '../lib/design-tokens';
import { Ionicons } from '@expo/vector-icons';

interface PhotoAnnotationEditorProps {
  imageUri: string;
  onSave: (annotatedUri: string) => void;
  onCancel: () => void;
  visible?: boolean;
}

type DrawingTool = 'pen' | 'arrow' | 'text' | 'rectangle';
type StrokeWidth = 'thin' | 'medium' | 'thick';

const COLORS = [
  { name: 'red', value: '#ef4444' },
  { name: 'blue', value: '#3b82f6' },
  { name: 'yellow', value: '#eab308' },
  { name: 'white', value: staticColors.white },
  { name: 'black', value: '#1f2937' },
];

const STROKE_WIDTHS: { name: StrokeWidth; value: number }[] = [
  { name: 'thin', value: 2 },
  { name: 'medium', value: 4 },
  { name: 'thick', value: 8 },
];

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export function PhotoAnnotationEditor({
  imageUri,
  onSave,
  onCancel,
  visible = true,
}: PhotoAnnotationEditorProps) {
  const { isDark, colors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  
  const [selectedTool, setSelectedTool] = useState<DrawingTool>('pen');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [strokeWidth, setStrokeWidth] = useState<StrokeWidth>('medium');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isPreparingImage, setIsPreparingImage] = useState(true);

  const bgColor = isDark ? '#0f172a' : '#f1f5f9';
  const toolbarBg = isDark ? '#1e293b' : colors.white;
  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  useEffect(() => {
    if (visible && imageUri) {
      loadImageAsBase64();
    }
    return () => {
      setImageBase64(null);
      setIsLoaded(false);
      setLoadError(null);
      setIsPreparingImage(true);
      setHasChanges(false);
    };
  }, [visible, imageUri]);

  const loadImageAsBase64 = async () => {
    setIsPreparingImage(true);
    setLoadError(null);
    
    try {
      let base64Data: string;
      
      if (imageUri.startsWith('data:')) {
        base64Data = imageUri;
      } else if (imageUri.startsWith('file://') || imageUri.startsWith('/')) {
        const fileUri = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        
        if (!fileInfo.exists) {
          throw new Error('Image file not found');
        }
        
        const base64Content = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        base64Data = `data:${mimeType};base64,${base64Content}`;
      } else if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
        const tempPath = `${FileSystem.cacheDirectory}annotation_temp_${Date.now()}.jpg`;
        
        const downloadResult = await FileSystem.downloadAsync(imageUri, tempPath);
        
        if (downloadResult.status !== 200) {
          throw new Error('Failed to download image');
        }
        
        const base64Content = await FileSystem.readAsStringAsync(downloadResult.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        const ext = imageUri.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        base64Data = `data:${mimeType};base64,${base64Content}`;
        
        await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
      } else {
        throw new Error('Unsupported image URI format');
      }
      
      setImageBase64(base64Data);
      setIsPreparingImage(false);
    } catch (error: any) {
      if (__DEV__) console.error('Failed to load image for annotation:', error);
      setLoadError(error.message || 'Failed to load image');
      setIsPreparingImage(false);
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'change') {
        setHasChanges(true);
      } else if (data.type === 'export') {
        setIsSaving(false);
        onSave(data.data);
      } else if (data.type === 'loaded') {
        setIsLoaded(true);
      } else if (data.type === 'error') {
        setLoadError(data.message || 'Failed to load image in editor');
        setIsLoaded(true);
      }
    } catch (e) {
      if (__DEV__) console.error('Failed to parse message:', e);
      setIsSaving(false);
    }
  };

  const selectTool = (tool: DrawingTool) => {
    setSelectedTool(tool);
    webViewRef.current?.injectJavaScript(`setTool('${tool}'); true;`);
  };

  const selectColor = (color: string) => {
    setSelectedColor(color);
    webViewRef.current?.injectJavaScript(`setColor('${color}'); true;`);
  };

  const selectStrokeWidth = (width: StrokeWidth) => {
    setStrokeWidth(width);
    const widthValue = STROKE_WIDTHS.find(w => w.name === width)?.value || 4;
    webViewRef.current?.injectJavaScript(`setStrokeWidth(${widthValue}); true;`);
  };

  const handleUndo = () => {
    webViewRef.current?.injectJavaScript('undo(); true;');
  };

  const handleClearAll = () => {
    webViewRef.current?.injectJavaScript('clearAll(); true;');
    setHasChanges(false);
  };

  const handleSave = () => {
    setIsSaving(true);
    webViewRef.current?.injectJavaScript('exportImage(); true;');
  };

  const handleRetry = () => {
    setLoadError(null);
    loadImageAsBase64();
  };

  const initialColor = useRef(COLORS[0].value);
  const initialStrokeWidth = useRef(4);

  const htmlContent = imageBase64 ? `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      width: 100%; 
      height: 100%; 
      overflow: hidden;
      touch-action: none;
      background: ${bgColor};
    }
    #container {
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
    }
    #imageContainer {
      position: relative;
      max-width: 100%;
      max-height: 100%;
    }
    #bgImage {
      display: block;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    #canvas {
      position: absolute;
      top: 0;
      left: 0;
      touch-action: none;
    }
    #textInput {
      position: absolute;
      display: none;
      background: transparent;
      border: 2px dashed ${initialColor.current};
      color: ${initialColor.current};
      font-size: 18px;
      font-weight: 600;
      padding: 4px 8px;
      min-width: 100px;
      outline: none;
      font-family: system-ui, -apple-system, sans-serif;
    }
    #textInput.visible {
      display: block;
    }
  </style>
</head>
<body>
  <div id="container">
    <div id="imageContainer">
      <img id="bgImage" />
      <canvas id="canvas"></canvas>
      <input type="text" id="textInput" placeholder="Type text..." />
    </div>
  </div>
  <script>
    const container = document.getElementById('container');
    const imageContainer = document.getElementById('imageContainer');
    const bgImage = document.getElementById('bgImage');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const textInput = document.getElementById('textInput');
    
    let currentTool = 'pen';
    let currentColor = '${initialColor.current}';
    let currentStrokeWidth = ${initialStrokeWidth.current};
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let startX = 0;
    let startY = 0;
    let history = [];
    let currentPath = [];
    let loadTimeout = null;
    
    bgImage.onload = function() {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
        loadTimeout = null;
      }
      canvas.width = bgImage.naturalWidth;
      canvas.height = bgImage.naturalHeight;
      canvas.style.width = bgImage.offsetWidth + 'px';
      canvas.style.height = bgImage.offsetHeight + 'px';
      imageContainer.style.width = bgImage.offsetWidth + 'px';
      imageContainer.style.height = bgImage.offsetHeight + 'px';
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'loaded' }));
    };
    
    bgImage.onerror = function(e) {
      if (loadTimeout) {
        clearTimeout(loadTimeout);
        loadTimeout = null;
      }
      window.ReactNativeWebView.postMessage(JSON.stringify({ 
        type: 'error', 
        message: 'Failed to load image in editor' 
      }));
    };
    
    loadTimeout = setTimeout(function() {
      if (!bgImage.complete || bgImage.naturalWidth === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'error', 
          message: 'Image load timed out' 
        }));
      }
    }, 15000);
    
    bgImage.src = ${JSON.stringify(imageBase64)};
    
    function setTool(tool) {
      currentTool = tool;
      if (textInput.classList.contains('visible')) {
        commitText();
      }
    }
    
    function setColor(color) {
      currentColor = color;
      textInput.style.color = color;
      textInput.style.borderColor = color;
    }
    
    function setStrokeWidth(width) {
      currentStrokeWidth = width;
    }
    
    function getCanvasPosition(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const touch = e.touches ? e.touches[0] : e;
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    }
    
    function saveState() {
      history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (history.length > 50) history.shift();
    }
    
    function undo() {
      if (history.length > 0) {
        const lastState = history.pop();
        ctx.putImageData(lastState, 0, 0);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'change' }));
      }
    }
    
    function clearAll() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      history = [];
    }
    
    function startDrawing(e) {
      e.preventDefault();
      if (currentTool === 'text') {
        const pos = getCanvasPosition(e);
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        textInput.style.left = (pos.x * scaleX) + 'px';
        textInput.style.top = (pos.y * scaleY) + 'px';
        textInput.style.color = currentColor;
        textInput.style.borderColor = currentColor;
        textInput.value = '';
        textInput.classList.add('visible');
        textInput.focus();
        return;
      }
      
      isDrawing = true;
      saveState();
      const pos = getCanvasPosition(e);
      lastX = pos.x;
      lastY = pos.y;
      startX = pos.x;
      startY = pos.y;
      currentPath = [{ x: pos.x, y: pos.y }];
      
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentStrokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    
    function draw(e) {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getCanvasPosition(e);
      
      if (currentTool === 'pen') {
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastX = pos.x;
        lastY = pos.y;
        currentPath.push({ x: pos.x, y: pos.y });
      } else if (currentTool === 'rectangle' || currentTool === 'arrow') {
        if (history.length > 0) {
          ctx.putImageData(history[history.length - 1], 0, 0);
        }
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentStrokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        if (currentTool === 'rectangle') {
          ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
        } else if (currentTool === 'arrow') {
          drawArrow(startX, startY, pos.x, pos.y);
        }
      }
    }
    
    function drawArrow(fromX, fromY, toX, toY) {
      const headlen = Math.max(currentStrokeWidth * 4, 15);
      const dx = toX - fromX;
      const dy = toY - fromY;
      const angle = Math.atan2(dy, dx);
      
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
    
    function stopDrawing(e) {
      if (!isDrawing) return;
      isDrawing = false;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'change' }));
    }
    
    function commitText() {
      if (textInput.value.trim()) {
        saveState();
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = parseFloat(textInput.style.left) * scaleX;
        const y = parseFloat(textInput.style.top) * scaleY;
        
        ctx.font = 'bold ' + Math.max(currentStrokeWidth * 6, 18) + 'px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = currentColor;
        ctx.fillText(textInput.value, x + 4, y + 22);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'change' }));
      }
      textInput.classList.remove('visible');
      textInput.value = '';
    }
    
    textInput.addEventListener('blur', commitText);
    textInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        commitText();
      }
    });
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    canvas.addEventListener('touchcancel', stopDrawing);
    
    function exportImage() {
      try {
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = canvas.width;
        exportCanvas.height = canvas.height;
        const exportCtx = exportCanvas.getContext('2d');
        
        exportCtx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        exportCtx.drawImage(canvas, 0, 0);
        
        const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.9);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'export', data: dataUrl }));
      } catch (err) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'error', 
          message: 'Failed to export image: ' + err.message 
        }));
      }
    }
  </script>
</body>
</html>
  ` : '';

  const ToolButton = ({ 
    tool, 
    icon, 
    label 
  }: { 
    tool: DrawingTool; 
    icon: keyof typeof Ionicons.glyphMap; 
    label: string;
  }) => (
    <TouchableOpacity
      style={[
        styles.toolButton,
        { backgroundColor: selectedTool === tool ? colors.primary : 'transparent' },
      ]}
      onPress={() => selectTool(tool)}
      accessibilityLabel={label}
      data-testid={`button-tool-${tool}`}
    >
      <Ionicons
        name={icon}
        size={24}
        color={selectedTool === tool ? colors.white : textColor}
      />
      <Text
        style={[
          styles.toolLabel,
          { color: selectedTool === tool ? colors.white : textColor },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const showLoading = isPreparingImage || (!isLoaded && !loadError && imageBase64);

  return (
    <Modal
      onRequestClose={onCancel}
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
        {/* Top Bar */}
        <View style={[styles.topBar, { backgroundColor: toolbarBg, borderBottomColor: borderColor }]}>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={onCancel}
            data-testid="button-cancel-annotation"
          >
            <Ionicons name="close" size={28} color={textColor} />
          </TouchableOpacity>
          
          <Text style={[styles.title, { color: textColor }]}>Markup Photo</Text>
          
          <TouchableOpacity
            style={[
              styles.topBarButton,
              styles.saveButton,
              { backgroundColor: hasChanges ? colors.primary : colors.primary + '60' },
            ]}
            onPress={handleSave}
            disabled={!hasChanges || isSaving || !isLoaded || !!loadError}
            data-testid="button-save-annotation"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="checkmark" size={24} color={colors.white} />
            )}
          </TouchableOpacity>
        </View>

        {/* Drawing Area */}
        <View style={styles.drawingArea}>
          {showLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: textColor }]}>
                {isPreparingImage ? 'Preparing image...' : 'Loading image...'}
              </Text>
            </View>
          )}
          
          {loadError && (
            <View style={styles.errorOverlay}>
              <Ionicons name="alert-circle" size={48} color={colors.destructive} />
              <Text style={[styles.errorText, { color: textColor }]}>{loadError}</Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                onPress={handleRetry}
                data-testid="button-retry-load"
              >
                <Ionicons name="refresh" size={20} color={colors.white} />
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {imageBase64 && !loadError && (
            <WebView
              ref={webViewRef}
              source={{ html: htmlContent }}
              style={styles.webView}
              onMessage={handleMessage}
              scrollEnabled={false}
              bounces={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              originWhitelist={['*']}
              allowFileAccess={true}
              allowUniversalAccessFromFileURLs={true}
              mixedContentMode="always"
            />
          )}
        </View>

        {/* Bottom Toolbar */}
        <View style={[styles.bottomToolbar, { backgroundColor: toolbarBg, borderTopColor: borderColor }]}>
          {/* Tools Row */}
          <View style={styles.toolsRow}>
            <ToolButton tool="pen" icon="brush" label="Pen" />
            <ToolButton tool="arrow" icon="arrow-forward" label="Arrow" />
            <ToolButton tool="text" icon="text" label="Text" />
            <ToolButton tool="rectangle" icon="square-outline" label="Box" />
            
            <View style={styles.toolDivider} />
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleUndo}
              data-testid="button-undo"
            >
              <Ionicons name="arrow-undo" size={24} color={textColor} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleClearAll}
              data-testid="button-clear-all"
            >
              <Ionicons name="trash-outline" size={24} color={colors.destructive} />
            </TouchableOpacity>
          </View>

          {/* Color Picker Row */}
          <View style={styles.colorRow}>
            <Text style={[styles.rowLabel, { color: textColor }]}>Color:</Text>
            <View style={styles.colorPicker}>
              {COLORS.map((color) => (
                <TouchableOpacity
                  key={color.name}
                  style={[
                    styles.colorButton,
                    { backgroundColor: color.value },
                    selectedColor === color.value && styles.colorButtonSelected,
                    color.name === 'white' && styles.colorButtonWhite,
                  ]}
                  onPress={() => selectColor(color.value)}
                  data-testid={`button-color-${color.name}`}
                />
              ))}
            </View>
          </View>

          {/* Stroke Width Row */}
          <View style={styles.strokeRow}>
            <Text style={[styles.rowLabel, { color: textColor }]}>Stroke:</Text>
            <View style={styles.strokePicker}>
              {STROKE_WIDTHS.map((width) => (
                <TouchableOpacity
                  key={width.name}
                  style={[
                    styles.strokeButton,
                    { backgroundColor: strokeWidth === width.name ? colors.primary + '20' : 'transparent' },
                    { borderColor: strokeWidth === width.name ? colors.primary : borderColor },
                  ]}
                  onPress={() => selectStrokeWidth(width.name)}
                  data-testid={`button-stroke-${width.name}`}
                >
                  <View
                    style={[
                      styles.strokePreview,
                      { 
                        height: width.value,
                        backgroundColor: selectedColor,
                      },
                    ]}
                  />
                  <Text style={[styles.strokeLabel, { color: textColor }]}>
                    {width.name.charAt(0).toUpperCase() + width.name.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  topBarButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    borderRadius: radius.md,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  drawingArea: {
    flex: 1,
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 14,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    padding: spacing.xl,
  },
  errorText: {
    marginTop: spacing.md,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  retryButtonText: {
    color: staticColors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  bottomToolbar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    gap: spacing.md,
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toolButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    minWidth: 52,
    gap: 2,
  },
  toolLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  toolDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#e2e8f0',
    marginHorizontal: spacing.xs,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 50,
  },
  colorPicker: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  colorButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonSelected: {
    borderColor: '#3b82f6',
    transform: [{ scale: 1.1 }],
  },
  colorButtonWhite: {
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  strokeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  strokePicker: {
    flexDirection: 'row',
    gap: spacing.sm,
    flex: 1,
  },
  strokeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  strokePreview: {
    width: '100%',
    maxWidth: 40,
    borderRadius: 4,
  },
  strokeLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
