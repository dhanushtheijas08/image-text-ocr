// let worker = null;
// let isInitialized = false;
// const WORKER_KEEPALIVE = 300000; // 5 minutes
// let workerTimeout;

// function resetWorkerTimeout() {
//   clearTimeout(workerTimeout);
//   workerTimeout = setTimeout(() => {
//     if (worker) {
//       worker.terminate();
//       worker = null;
//       isInitialized = false;
//     }
//   }, WORKER_KEEPALIVE);
// }

// async function createWorker() {
//   try {
//     if (worker && isInitialized) {
//       resetWorkerTimeout();
//       return worker;
//     }

//     worker = await Tesseract.createWorker("eng", 1, {
//       workerPath: chrome.runtime.getURL(
//         "src/offscreen/tesseract/worker.min.js"
//       ),
//       corePath: chrome.runtime.getURL("src/offscreen/tesseract/"),
//       langPath: chrome.runtime.getURL("src/offscreen/tesseract/"),
//       workerBlobURL: false,
//       logger: (m) => console.log("Tesseract progress:", m),
//     });

//     isInitialized = true;
//     resetWorkerTimeout();
//     return worker;
//   } catch (error) {
//     console.error("Error creating Tesseract worker:", error);
//     isInitialized = false;
//     worker = null;
//     throw error;
//   }
// }

// async function processImage(imageUrl, requestId) {
//   try {
//     const tesseractWorker = await createWorker();
//     resetWorkerTimeout();

//     const result = await tesseractWorker.recognize(imageUrl);
//     chrome.runtime.sendMessage({
//       type: "OCR_RESULT",
//       requestId: requestId,
//       text: result.data.text,
//     });

//     return result.data.text;
//   } catch (error) {
//     chrome.runtime.sendMessage({
//       type: "OCR_RESULT",
//       requestId: requestId,
//       error: error instanceof Error ? error.message : "OCR processing failed",
//     });

//     if (worker) {
//       try {
//         await worker.terminate();
//       } catch (e) {
//         console.error("Error terminating worker:", e);
//       }
//       worker = null;
//       isInitialized = false;
//     }
//     throw error;
//   }
// }

// // Listen for messages from background
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.type === "PROCESS_OCR") {
//     if (!message.imageData) {
//       chrome.runtime.sendMessage({
//         type: "OCR_RESULT",
//         requestId: message.requestId,
//         error: "No image data provided",
//       });
//       return false;
//     }

//     (async () => {
//       try {
//         await processImage(message.imageData, message.requestId);
//       } catch (error) {
//         console.error("Offscreen processing error:", error);
//       }
//     })();

//     return true;
//   }

//   return false;
// });

// // Clean up worker
// window.addEventListener("beforeunload", async () => {
//   if (worker) {
//     try {
//       await worker.terminate();
//     } catch (error) {
//       console.error("Error terminating worker:", error);
//     }
//     worker = null;
//     isInitialized = false;
//   }
// });

// window.addEventListener("pagehide", async () => {
//   if (worker) {
//     try {
//       await worker.terminate();
//     } catch (error) {
//       console.error("Error terminating worker:", error);
//     }
//     worker = null;
//     isInitialized = false;
//   }
// });

let worker = null;
let isInitialized = false;
const WORKER_KEEPALIVE = 300000; // 5 minutes
let workerTimeout;

function resetWorkerTimeout() {
  clearTimeout(workerTimeout);
  workerTimeout = setTimeout(() => {
    if (worker) {
      worker.terminate();
      worker = null;
      isInitialized = false;
      console.log("[OFFSCREEN] Worker terminated due to inactivity");
    }
  }, WORKER_KEEPALIVE);
}

async function createWorker() {
  try {
    if (worker && isInitialized) {
      resetWorkerTimeout();
      return worker;
    }

    console.log("[OFFSCREEN] Creating new Tesseract worker");
    worker = await Tesseract.createWorker("eng", 1, {
      workerPath: chrome.runtime.getURL(
        "src/offscreen/tesseract/worker.min.js"
      ),
      corePath: chrome.runtime.getURL("src/offscreen/tesseract/"),
      langPath: chrome.runtime.getURL("src/offscreen/tesseract/"),
      workerBlobURL: false,
      logger: (m) => console.log("[OFFSCREEN] Tesseract progress:", m),
    });

    isInitialized = true;
    resetWorkerTimeout();
    console.log("[OFFSCREEN] Worker created successfully");
    return worker;
  } catch (error) {
    console.error("[OFFSCREEN] Error creating Tesseract worker:", error);
    isInitialized = false;
    worker = null;
    throw error;
  }
}

async function processImage(imageUrl, requestId) {
  console.log("[OFFSCREEN] Starting OCR processing for request:", requestId);

  try {
    const tesseractWorker = await createWorker();
    resetWorkerTimeout();

    const result = await tesseractWorker.recognize(imageUrl);

    console.log(
      "[OFFSCREEN] OCR completed successfully for request:",
      requestId
    );

    // Send result back to background script
    chrome.runtime
      .sendMessage({
        type: "OCR_RESULT",
        requestId: requestId,
        text: result.data.text,
      })
      .catch((error) => {
        console.error("[OFFSCREEN] Error sending OCR result:", error);
      });

    return result.data.text;
  } catch (error) {
    console.error("[OFFSCREEN] OCR processing failed:", error);

    // Send error back to background script
    chrome.runtime
      .sendMessage({
        type: "OCR_RESULT",
        requestId: requestId,
        error: error instanceof Error ? error.message : "OCR processing failed",
      })
      .catch((sendError) => {
        console.error("[OFFSCREEN] Error sending OCR error:", sendError);
      });

    // Clean up worker on error
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        console.error("[OFFSCREEN] Error terminating worker:", e);
      }
      worker = null;
      isInitialized = false;
    }
    throw error;
  }
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[OFFSCREEN] Received message:", message.type);

  if (message.type === "PROCESS_OCR" && message.target === "offscreen") {
    if (!message.imageData) {
      console.error("[OFFSCREEN] No image data provided");
      chrome.runtime
        .sendMessage({
          type: "OCR_RESULT",
          requestId: message.requestId,
          error: "No image data provided",
        })
        .catch(console.error);
      return false;
    }

    // Process OCR asynchronously
    processImage(message.imageData, message.requestId).catch((error) => {
      console.error("[OFFSCREEN] OCR processing error:", error);
    });

    // Send acknowledgment back to background
    sendResponse({ acknowledged: true });
    return false; // Don't keep message channel open
  }

  return false;
});

// Clean up worker on page unload
const cleanup = async () => {
  if (worker) {
    try {
      console.log("[OFFSCREEN] Cleaning up worker");
      await worker.terminate();
    } catch (error) {
      console.error("[OFFSCREEN] Error terminating worker:", error);
    }
    worker = null;
    isInitialized = false;
  }
};

window.addEventListener("beforeunload", cleanup);
window.addEventListener("pagehide", cleanup);

// Clean up timeout on unload
window.addEventListener("beforeunload", () => {
  if (workerTimeout) {
    clearTimeout(workerTimeout);
  }
});

console.log("[OFFSCREEN] Offscreen script initialized");
