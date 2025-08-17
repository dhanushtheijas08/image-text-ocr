const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/offscreen.html";
console.log("from background");

// Offscreen document management
async function ensureOffscreenDocument() {
  try {
    const hasDocument = await chrome.offscreen.hasDocument();
    if (hasDocument) {
      console.log("Offscreen document already exists");
      return;
    }

    console.log("Creating offscreen document");
    console.log(OFFSCREEN_DOCUMENT_PATH);
    console.log(chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH));

    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: "Required for HTML parsing and OCR processing",
    });

    console.log("Offscreen document created successfully");

    // Give the offscreen document a moment to initialize
    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch (error) {
    console.error("Failed to create offscreen document:", error);
    throw error;
  }
}

// Initialize offscreen document on startup
ensureOffscreenDocument();

async function sendToOffscreen<T>(message: any): Promise<T> {
  try {
    await ensureOffscreenDocument();

    console.log("Sending to offscreen:", message);

    return new Promise((resolve, reject) => {
      // Add a timeout to catch hanging requests
      const timeout = setTimeout(() => {
        reject(new Error("Offscreen request timeout after 30 seconds"));
      }, 30000);

      chrome.runtime.sendMessage(
        {
          target: "offscreen",
          ...message,
        },
        (response) => {
          clearTimeout(timeout);
          console.log("Received response from offscreen:", response);

          if (chrome.runtime.lastError) {
            console.error("Error from offscreen", chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else if (!response) {
            console.error("No response received from offscreen");
            reject(new Error("No response received from offscreen"));
          } else {
            console.log("Resolved response from offscreen");
            resolve(response);
          }
        }
      );
    });
  } catch (error) {
    console.error("Error in sendToOffscreen:", error);
    throw error;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "TAKE_SCREENSHOT") {
    if (!sender.tab?.id) return;

    chrome.tabs.sendMessage(
      sender.tab.id,
      { type: "GET_VIEWPORT_SIZE" },
      async (viewport) => {
        console.log("Background: received viewport:", viewport);

        if (!viewport) {
          console.error("Viewport not received");
          return;
        }

        chrome.windows.getCurrent({ populate: false }, async (window) => {
          if (!window?.id) return;

          // Capture with high quality for better results
          const dataUrl = await chrome.tabs.captureVisibleTab(window.id, {
            format: "png",
            quality: 100, // Add quality parameter
          });

          chrome.tabs.sendMessage(sender.tab!.id!, {
            type: "SCREEN_CAPTURE_RESULT",
            dataUrl,
            rect: message.rect,
            viewport,
          });
        });
      }
    );

    return true;
  }

  // Handle TRIGGER_OCR message from content script
  if (message.type === "TRIGGER_OCR") {
    console.log("[BACKGROUND] Processing OCR trigger");

    sendToOffscreen<{ result: string }>({
      type: "OCR_IMAGE",
      imageData: message.imageData,
    })
      .then((response) => {
        console.log("OCR result:", response);
        sendResponse({ success: true, text: response.result });
      })
      .catch((error) => {
        console.error("Offscreen error:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  }

  if (message.type === "SAVE_IMAGE") {
    console.log("[BACKGROUND] Saving image from data URL");

    // chrome.downloads.download({
    //   url: message.dataUrl,
    //   filename: `screenshot_${Date.now()}.png`, // Add timestamp
    //   saveAs: false,
    // });

    sendToOffscreen<{ result: string }>({
      type: "OCR_IMAGE",
      imageData: message.dataUrl,
    })
      .then((response) => {
        console.log("OCR result:", response);
        sendResponse({ success: true, result: response.result });
      })
      .catch((error) => {
        console.error("Offscreen error:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  }

  if (message.type === "OCR_IMAGE") {
    console.log("[BACKGROUND] Processing OCR request");

    sendToOffscreen<{ result: string }>({
      type: "OCR_IMAGE",
      imageData: message.imageData,
    })
      .then((response) => {
        console.log("OCR result:", response);
        sendResponse({ success: true, result: response.result });
      })
      .catch((error) => {
        console.error("Offscreen error:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  }

  // Handle PARSE_HTML message from content script
  if (message.type === "PARSE_HTML") {
    console.log("[BACKGROUND] Processing HTML parsing request");

    sendToOffscreen<{ result: string }>({
      type: "PARSE_HTML",
      html: message.html,
    })
      .then((response) => {
        console.log("HTML parsing result:", response);
        sendResponse({ success: true, result: response.result });
      })
      .catch((error) => {
        console.error("Offscreen error:", error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep the message channel open for async response
  }

  return false;
});

// Clean up offscreen document when not needed
chrome.runtime.onSuspend.addListener(() => {
  chrome.offscreen.closeDocument();
});
