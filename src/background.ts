// const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/offscreen.html";
// const pendingOcrRequests: Record<string, Function> = {};

// // Offscreen document management
// async function ensureOffscreenDocument() {
//   try {
//     const hasDocument = await chrome.offscreen.hasDocument();
//     if (hasDocument) {
//       return;
//     }

//     await chrome.offscreen.createDocument({
//       url: chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
//       reasons: [chrome.offscreen.Reason.DOM_PARSER],
//       justification: "Required for HTML parsing and OCR processing",
//     });

//     await new Promise((resolve) => setTimeout(resolve, 100));
//   } catch (error) {
//     throw error;
//   }
// }

// // Initialize offscreen document on startup
// ensureOffscreenDocument();

// chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
//   if (message.type === "TAKE_SCREENSHOT") {
//     if (!sender.tab?.id) return false;

//     chrome.windows.getCurrent({ populate: false }, async (window) => {
//       if (!window?.id) return;

//       const dataUrl = await chrome.tabs.captureVisibleTab(window.id, {
//         format: "png",
//         quality: 100,
//       });

//       chrome.tabs.sendMessage(sender.tab!.id!, {
//         type: "SCREEN_CAPTURE_RESULT",
//         dataUrl,
//         rect: message.rect,
//       });
//     });

//     return true;
//   }

//   if (message.type === "TRIGGER_OCR") {
//     console.log("[BACKGROUND] Processing OCR trigger");
//     const requestId =
//       Date.now().toString() + Math.random().toString(36).substr(2, 5);

//     pendingOcrRequests[requestId] = sendResponse;

//     try {
//       await ensureOffscreenDocument();

//       chrome.runtime.sendMessage(
//         {
//           target: "offscreen",
//           type: "PROCESS_OCR",
//           imageData: message.imageData,
//           requestId,
//         },
//         (ack) => {
//           if (chrome.runtime.lastError) {
//             console.error("Offscreen comm error:", chrome.runtime.lastError);
//             sendResponse({
//               success: false,
//               error:
//                 "Failed to send to offscreen: " +
//                 chrome.runtime.lastError.message,
//             });
//             delete pendingOcrRequests[requestId];
//           }
//         }
//       );
//     } catch (error) {
//       console.error("Error ensuring offscreen:", error);
//       sendResponse({
//         success: false,
//         error:
//           "Offscreen error: " +
//           (error instanceof Error ? error.message : "Unknown error"),
//       });
//       delete pendingOcrRequests[requestId];
//     }

//     return true;
//   }

//   if (message.type === "OCR_RESULT") {
//     const { requestId, text, error } = message;
//     if (pendingOcrRequests[requestId]) {
//       pendingOcrRequests[requestId]({
//         success: !error,
//         text: text || "",
//         error: error || null,
//       });
//       delete pendingOcrRequests[requestId];
//     }
//     console.log("send to app");

//     console.log("Sending OCR result to app:", { requestId, text, error });

//     try {
//       chrome.runtime.sendMessage({
//         type: "COPY_OCR_RESULT",
//         text,
//         error,
//       });
//     } catch (error) {
//       console.error("Failed to send OCR result to app:", error);
//     }
//     return true;
//   }
// });

// // Clean up offscreen document when not needed
// chrome.runtime.onSuspend.addListener(() => {
//   chrome.offscreen.closeDocument();
// });

const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/offscreen.html";
const pendingOcrRequests = new Map();

async function ensureOffscreenDocument() {
  try {
    const hasDocument = await chrome.offscreen.hasDocument();
    if (hasDocument) {
      return;
    }

    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH),
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: "Required for HTML parsing and OCR processing",
    });

    // Wait a bit longer for offscreen to initialize
    await new Promise((resolve) => setTimeout(resolve, 200));
  } catch (error) {
    console.error("Error creating offscreen document:", error);
    throw error;
  }
}

ensureOffscreenDocument().catch(console.error);

const captureFullScreen = async (
  sender: any,
  sendResponse: any,
  message: any
) => {
  if (!sender.tab?.id) {
    sendResponse({ success: false, error: "No tab ID" });
    return false;
  }
  try {
    const window = await chrome.windows.getCurrent({ populate: false });
    if (!window?.id) {
      throw new Error("No window ID");
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(window.id, {
      format: "png",
      quality: 100,
    });

    if (!message.fullScreen) {
      await chrome.tabs.sendMessage(sender.tab?.id || 1, {
        type: "SCREEN_CAPTURE_RESULT",
        dataUrl,
      });
    } else {
      // console.log({ dataUrl });
      // // Download the image using chrome.downloads API
      // await chrome.downloads.download({
      //   url: dataUrl,
      //   filename: "screenshot.png",
      //   saveAs: false,
      // });
      handleOcrTrigger({ imageData: dataUrl }, sendResponse);
    }

    sendResponse({ success: true });
  } catch (error) {
    console.error("[BACKGROUND] Screenshot error:", error);
    sendResponse({
      success: false,
      error: error || "Screenshot failed",
    });
  }
};

const handleOcrTrigger = async (message: any, sendResponse: any) => {
  console.log("[BACKGROUND] Processing OCR trigger");
  const requestId =
    Date.now().toString() + Math.random().toString(36).substr(2, 5);
  pendingOcrRequests.set(requestId, sendResponse);

  try {
    await ensureOffscreenDocument();

    // Send message to offscreen with error handling
    chrome.runtime
      .sendMessage({
        target: "offscreen",
        type: "PROCESS_OCR",
        imageData: message.imageData,
        requestId,
      })
      .catch((error) => {
        console.error("[BACKGROUND] Error sending to offscreen:", error);
        const storedResponse = pendingOcrRequests.get(requestId);
        if (storedResponse) {
          storedResponse({
            success: false,
            error: "Failed to send to offscreen: " + error.message,
          });
          pendingOcrRequests.delete(requestId);
        }
      });
  } catch (error) {
    console.error("[BACKGROUND] Error ensuring offscreen:", error);
    const storedResponse = pendingOcrRequests.get(requestId);
    if (storedResponse) {
      storedResponse({
        success: false,
        error: "Offscreen error: " + error,
      });
      pendingOcrRequests.delete(requestId);
    }
  }
};

const handleOcrResult = async (message: any) => {
  console.log("[BACKGROUND] Received OCR result");
  const { requestId, text, error } = message;

  const storedResponse = pendingOcrRequests.get(requestId);
  if (storedResponse) {
    storedResponse({
      success: !error,
      text: text || "",
      error: error || null,
    });
    pendingOcrRequests.delete(requestId);
  }

  try {
    const tabs = await chrome.tabs.query({});
    const promises = tabs.map(async (tab) => {
      if (tab.id) {
        console.log({ text: message.text });

        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: "COPY_OCR_RESULT",
            text: message.text,
            error: message.error,
          });
        } catch (tabError) {
          console.debug(
            `[BACKGROUND] Could not send to tab ${tab.id}:`,
            tabError
          );
        }
      }
    });

    await Promise.allSettled(promises);
    console.log("[BACKGROUND] OCR result broadcast to all tabs");
  } catch (error) {
    console.error("[BACKGROUND] Failed to broadcast OCR result:", error);
  }
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "TAKE_SCREENSHOT":
      captureFullScreen(sender, sendResponse, message);
      return true;

    case "TRIGGER_OCR":
      handleOcrTrigger(message, sendResponse);
      return true;

    case "OCR_RESULT":
      handleOcrResult(message);
      return false;
  }
  return false;
});

chrome.runtime.onSuspend.addListener(async () => {
  try {
    await chrome.offscreen.closeDocument();
  } catch (error) {
    console.error("Error closing offscreen document:", error);
  }
});

chrome.runtime.onStartup.addListener(() => {
  pendingOcrRequests.clear();
});

chrome.runtime.onInstalled.addListener(() => {
  pendingOcrRequests.clear();
});
