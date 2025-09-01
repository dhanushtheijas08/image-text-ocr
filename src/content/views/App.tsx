import { useToast } from "@/components/ui/toast";
import "cropperjs/dist/cropper.css";
import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [toggle, setToggle] = useState<boolean>(false);
  const { showToast } = useToast();

  const [rect, setRect] = useState({ x: 100, y: 100, width: 200, height: 150 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    const clickX = e.clientX;
    const clickY = e.clientY;

    const isInsideRect =
      clickX >= rect.x &&
      clickX <= rect.x + rect.width &&
      clickY >= rect.y &&
      clickY <= rect.y + rect.height;

    if (isInsideRect) {
      const offsetX = clickX - rect.x;
      const offsetY = clickY - rect.y;

      const onMouseMove = (ev: MouseEvent) => {
        const newX = ev.clientX - offsetX;
        const newY = ev.clientY - offsetY;

        setRect((prev) => ({
          ...prev,
          x: newX,
          y: newY,
        }));
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    } else {
      const startX = clickX;
      const startY = clickY;

      const onMouseMove = (ev: MouseEvent) => {
        const endX = ev.clientX;
        const endY = ev.clientY;

        setRect({
          x: Math.min(startX, endX),
          y: Math.min(startY, endY),
          width: Math.abs(endX - startX),
          height: Math.abs(endY - startY),
        });
      };

      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
  };

  const handleCapture = async (isFullScreen: boolean) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: "TAKE_SCREENSHOT",
          rect,
          fullScreen: isFullScreen,
        },
        (res) => {
          if (res?.success) {
            console.log("Capture initiated successfully");
          } else {
            console.error("Failed to initiate screen capture");
          }
        }
      );
    } catch (error) {
      console.error("Error occurred while capturing screenshot:", error);
    }
  };

  const saveImage = async (dataUrl: string) => {
    try {
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        devicePixelRatio: window.devicePixelRatio || 1,
      };
      const img = new Image();
      img.src = dataUrl;
      await img.decode();

      const canvas = document.createElement("canvas");
      canvas.width = rect.width;
      canvas.height = rect.height;

      const ctx = canvas.getContext("2d")!;

      const scale = viewport.devicePixelRatio || window.devicePixelRatio || 1;

      const viewportRelativeX = rect.x - viewport.scrollX;
      const viewportRelativeY = rect.y - viewport.scrollY;

      const sourceX = viewportRelativeX * scale;
      const sourceY = viewportRelativeY * scale;
      const sourceWidth = rect.width * scale;
      const sourceHeight = rect.height * scale;

      if (
        sourceX < 0 ||
        sourceY < 0 ||
        sourceX + sourceWidth > img.width ||
        sourceY + sourceHeight > img.height
      ) {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      } else {
        ctx.drawImage(
          img,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          rect.width,
          rect.height
        );
      }

      const croppedDataUrl = canvas.toDataURL("image/png");

      try {
        const ocrResponse = await chrome.runtime.sendMessage({
          type: "TRIGGER_OCR",
          imageData: croppedDataUrl,
        });
        if (!ocrResponse?.success) {
          console.error("OCR processing failed:", ocrResponse?.error);
        }
      } catch (ocrError) {
        console.error("Error sending OCR request:", ocrError);
      }
    } catch (error) {
      console.error("Error processing image:", error);
    }
  };

  useEffect(() => {
    const listener = (message: any) => {
      if (message.type === "CROP_AREA_CAPTURE") {
        setToggle(true);
      } else if (message.type === "FULL_SCREEN_CAPTURE") {
        handleCapture(true);
      } else if (message.type === "SCREEN_CAPTURE_RESULT") {
        const { dataUrl } = message;
        if (!dataUrl) {
          console.error("Invalid data received from background script");
          return;
        }
        saveImage(dataUrl);
        setToggle(false);
      } else if (message.type === "COPY_OCR_RESULT") {
        navigator.clipboard
          .writeText(message.text)
          .then(() => {
            console.log("OCR result copied to clipboard");
            showToast("Text copied to clipboard", "success");
          })
          .catch((err) => {
            console.error("Failed to copy OCR result:", err);
          });
      }
    };

    const keypressListener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setToggle(false);
      } else if (e.ctrlKey && e.key === "]") {
        setToggle(true);
      }
    };

    window.addEventListener("keydown", keypressListener);
    chrome.runtime.onMessage.addListener(listener);

    return () => {
      window.removeEventListener("keydown", keypressListener);
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [rect]);

  return (
    <div className="popup-container">
      {toggle && (
        <div ref={overlayRef} className="overlay" onMouseDown={handleMouseDown}>
          <div
            className="selection-box"
            style={{
              top: rect.y,
              left: rect.x,
              width: rect.width,
              height: rect.height,
            }}
          />
          <button onClick={() => handleCapture(false)} className="capture-btn">
            Capture & Extract Text
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
