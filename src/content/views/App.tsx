import "cropperjs/dist/cropper.css";
import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const [toggle, setToggle] = useState<boolean>(false);

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

  const handleCapture = () => {
    console.log("from App.tsx - capturing rect:", rect);

    chrome.runtime.sendMessage(
      {
        type: "TAKE_SCREENSHOT", // Changed from CAPTURE_SCREEN to TAKE_SCREENSHOT
        rect,
      },
      (res) => {
        if (res?.success) {
          console.log("Capture initiated successfully");
        } else {
          console.error("Failed to initiate screen capture");
        }
      }
    );
  };

  const saveImage = async (
    dataUrl: string,
    viewport: { scrollX: number; scrollY: number; devicePixelRatio?: number }
  ) => {
    console.log("saveImage called with:", { rect, viewport });

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

    console.log("Cropping parameters:", {
      originalRect: rect,
      viewport,
      scale,
      viewportRelativeX,
      viewportRelativeY,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      capturedImageSize: { width: img.width, height: img.height },
    });

    if (
      sourceX < 0 ||
      sourceY < 0 ||
      sourceX + sourceWidth > img.width ||
      sourceY + sourceHeight > img.height
    ) {
      console.error("Crop area is outside the captured image bounds!");
      console.error("Crop bounds:", {
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
      });
      console.error("Image bounds:", { width: img.width, height: img.height });

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
    // chrome.runtime.sendMessage({
    //   type: "SAVE_IMAGE",
    //   dataUrl: croppedDataUrl,
    // });

    console.log("Sending message to background for OCR");

    chrome.runtime.sendMessage(
      {
        type: "TRIGGER_OCR",
        imageData: croppedDataUrl,
      },
      (response) => {
        if (!response) {
          console.error("No response received", chrome.runtime.lastError);
          return;
        }

        console.log("response", response);
      }
    );

    console.log("✅ Cropped and sent to background for download");
  };

  useEffect(() => {
    const listener = (message: any, sender: any, sendResponse: any) => {
      if (message.type === "TAKE_SCREEN_SHORT") {
        setToggle(true);
      } else if (message.type === "SCREEN_CAPTURE_RESULT") {
        const { dataUrl, viewport } = message;
        if (!dataUrl) {
          console.error("Invalid data received from background script");
          return;
        }
        console.log("Received capture result:", {
          viewport,
          dataUrlLength: dataUrl.length,
        });
        saveImage(dataUrl, viewport);
        setToggle(false); // Hide overlay after capture
      } else if (message.type === "GET_VIEWPORT_SIZE") {
        console.log("Content script: GET_VIEWPORT_SIZE received");

        const viewportInfo = {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          devicePixelRatio: window.devicePixelRatio || 1,
        };

        console.log("Sending viewport info:", viewportInfo);
        sendResponse(viewportInfo);
        return true;
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
  }, [rect]); // Add rect to dependencies

  const parseHTML = () => {
    chrome.runtime.sendMessage(
      {
        type: "PARSE_HTML", // Changed from OCR_IMAGE to PARSE_HTML
        html: "<div>Hello <b>World</b>!</div>",
      },
      (response) => {
        if (!response) {
          console.error("No response received", chrome.runtime.lastError);
          return;
        }

        console.log("response", response);
      }
    );
  };

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
          <button onClick={handleCapture} className="capture-btn">
            Capture & Extract Text
          </button>
          <div
            className="debug-info"
            style={{
              position: "fixed",
              top: "60px",
              right: "20px",
              background: "rgba(0,0,0,0.8)",
              color: "white",
              padding: "10px",
              borderRadius: "4px",
              fontSize: "12px",
              zIndex: 10001,
            }}
          >
            Rect: {rect.x}, {rect.y}, {rect.width}×{rect.height}
            <br />
            Scroll: {window.scrollX}, {window.scrollY}
          </div>
        </div>
      )}
      <button onClick={parseHTML}>Parse HTML</button>
    </div>
  );
}

export default App;
