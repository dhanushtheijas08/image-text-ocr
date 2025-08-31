import {
  Camera,
  Clipboard,
  Crop,
  FileImage,
  Monitor,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import "./App.css";

const App = () => {
  const [processing, setProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [hasClipboardImage, setHasClipboardImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const handleFullScreen = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            type: "FULL_SCREEN_CAPTURE",
            payload: { message: "Full screen capture" },
          },
          (response) => {
            console.log("Response from content script:", response);
          }
        );
      }
    });
  };
  // Check for clipboard image on mount
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const clipboardItems = await navigator.clipboard.read();
        const hasImage = clipboardItems.some((item) =>
          item.types.some((type) => type.startsWith("image/"))
        );
        setHasClipboardImage(hasImage);
      } catch (err) {
        setHasClipboardImage(false);
      }
    };

    checkClipboard();

    // Listen for clipboard changes
    const interval = setInterval(checkClipboard, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) return;

    setProcessing(true);
    // Simulate OCR processing
    setTimeout(() => {
      setExtractedText(
        `Extracted text from ${file.name}:\n\nSample extracted text would appear here...`
      );
      setProcessing(false);
    }, 2000);
  };

  const handleCropArea = () => {
    setProcessing(true);
    // Simulate crop area capture
    setTimeout(() => {
      setExtractedText(
        "Extracted text from cropped area:\n\nSample text from selected area..."
      );
      setProcessing(false);
    }, 1500);
  };

  const handleClipboardPaste = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith("image/")) {
            setProcessing(true);
            setTimeout(() => {
              setExtractedText(
                "Extracted text from clipboard image:\n\nSample text from pasted image..."
              );
              setProcessing(false);
            }, 1500);
            return;
          }
        }
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  return (
    <div className="popup-container">
      <div className="popup-header">
        <img src="./images/logo.jpeg" alt="Snap & Extract" className="logo" />
        <h1 className="popup-title">Snap & Extract</h1>
      </div>

      <div className="main-content">
        <div className="capture-section">
          <div className="section-title">
            <Camera size={16} />
            Screen Capture
          </div>

          <div className="action-buttons">
            <button className="action-btn" onClick={handleFullScreen}>
              <span className="shortcut">Ctrl+[</span>
              <Monitor size={20} color="#70af59" />
              <div className="action-btn-title">Full Screen</div>
            </button>

            <button className="action-btn" onClick={handleCropArea}>
              <span className="shortcut">Ctrl+]</span>
              <Crop size={20} color="#70af59" />
              <div className="action-btn-title">Crop Area</div>
            </button>
          </div>
        </div>

        <div className="clipboard-section">
          <div className="section-title">
            <Clipboard size={16} />
            Clipboard
          </div>

          <div className="clipboard-btn-container">
            <button
              className={`clipboard-btn-main ${
                !hasClipboardImage ? "disabled" : ""
              }`}
              onClick={handleClipboardPaste}
              disabled={!hasClipboardImage}
            >
              <Clipboard size={18} color="#70af59" />
              <span>Paste from Clipboard</span>
              <span
                className={`clipboard-status ${
                  hasClipboardImage ? "ready" : "not-ready"
                }`}
              >
                {hasClipboardImage ? "Ready" : "None"}
              </span>
            </button>
          </div>
        </div>

        <div className="upload-section">
          <div className="section-title">
            <Upload size={16} />
            File Upload
          </div>

          <div
            ref={dropZoneRef}
            className="drop-zone"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileImage size={28} className="upload-icon" color="#70af59" />
            <div className="upload-text">Upload from device</div>
            <div className="upload-hint">Supports PNG, JPG, JPEG, WebP</div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) =>
              e.target.files?.[0] && handleFileUpload(e.target.files[0])
            }
            className="file-input"
          />
        </div>
      </div>

      <div className="popup-footer">
        <div className="footer-content">
          <span className="made-by">Made with ❤️ by</span>
          <a
            className="author-name"
            href="https://dhanushtheijas.vercel.app/"
            target="_blank"
          >
            dhanush theijas
          </a>
        </div>
        <div className="footer-links">
          <a
            href="https://github.com/dhanushtheijas08/image-text-ocr"
            className="footer-link"
            target="_blank"
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
};

export default App;
