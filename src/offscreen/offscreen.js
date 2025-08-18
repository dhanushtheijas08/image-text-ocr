let worker = null;
let isInitialized = false;
// Add at top
const WORKER_KEEPALIVE = 300000; // 5 minutes
let workerTimeout;
async function createWorker() {
  console.log("Creating Tesseract worker");
  try {
    if (worker && isInitialized) {
      console.log("Using existing worker");
      return worker;
    }

    // Now that we've patched tesseract.min.js to use local paths,
    // we can use the standard approach with explicit local configuration
    worker = await Tesseract.createWorker("eng", 1, {
      workerPath: chrome.runtime.getURL(
        "src/offscreen/tesseract/worker.min.js"
      ),
      corePath: chrome.runtime.getURL(
        "src/offscreen/tesseract/tesseract-core.wasm.js"
      ),
      langPath: chrome.runtime.getURL("src/offscreen/tesseract/"),
      workerBlobURL: false,
      logger: (m) => {
        console.log("Tesseract progress:", m);
      },
    });

    isInitialized = true;
    console.log("Tesseract worker created successfully");
    // Reset keepalive timer
    resetWorkerTimeout();
    return worker;
  } catch (error) {
    console.error("Error creating Tesseract worker:", error);
    isInitialized = false;
    worker = null;
    throw error;
  }
}

function resetWorkerTimeout() {
  clearTimeout(workerTimeout);
  workerTimeout = setTimeout(() => {
    if (worker) {
      worker.terminate();
      worker = null;
      isInitialized = false;
      console.log("Worker terminated due to inactivity");
    }
  }, WORKER_KEEPALIVE);
}

async function processImage(imageUrl, requestId) {
  try {
    const tesseractWorker = await createWorker();

    console.log("Processing image:", imageUrl);
    const result = await tesseractWorker.recognize(imageUrl);
    // Send result directly to background
    chrome.runtime.sendMessage({
      type: "OCR_RESULT",
      requestId: requestId,
      result: result.data.text,
    });
    console.log("OCR Result:", result.data.text);
    resetWorkerTimeout();
    return result.data.text;
  } catch (error) {
    console.error("OCR Error:", error);
    // Reset worker on error
    if (worker) {
      try {
        await worker.terminate();
      } catch (e) {
        console.error("Error terminating worker:", e);
      }
      worker = null;
      isInitialized = false;
    }
    return "";
  }
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Offscreen receive message:", message);
  console.log("Message sender:", sender);

  // Handle OCR_IMAGE messages
  if (message.type === "TRIGGER_OCR") {
    console.log("Processing OCR_IMAGE message");

    // Check if we have image data
    if (!message.imageData) {
      console.error("No image data provided");
      const errorResponse = { error: "No image data provided" };
      console.log("Sending error response:", errorResponse);
      sendResponse(errorResponse);
      return false;
    }

    console.log("Starting async OCR processing");

    // Handle async processing
    console.log({ message });

    (async () => {
      try {
        console.log("Processing OCR request");
        const result = await processImage(message.imageData, message.requestId);
        console.log("OCR completed, result:", result);

        // const successResponse = { result: result };
        // console.log("Sending success response:", successResponse);
        // sendResponse(successResponse);
      } catch (error) {
        console.error("Offscreen processing error:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const errorResponse = { error: errorMessage };
        // console.log("Sending error response:", errorResponse);
        // sendResponse(errorResponse);
        chrome.runtime.sendMessage({
          type: "OCR_RESULT",
          requestId,
          error: error.message,
        });
      }
    })();

    console.log("Returning true from OCR_IMAGE handler");
    // Return true to indicate we will send a response asynchronously
    return true;
  }

  // Handle PARSE_HTML messages
  // if (message.type === "PARSE_HTML") {
  //   console.log("Processing PARSE_HTML message");

  //   try {
  //     console.log("Processing HTML parsing request");
  //     const result = "Sample result new";
  //     console.log("HTML parsing completed:", result);

  //     const successResponse = { result: result };
  //     console.log("Sending HTML parse success response:", successResponse);
  //     sendResponse("This is a new response");
  //   } catch (error) {
  //     console.error("HTML parsing error:", error);
  //     const errorMessage =
  //       error instanceof Error ? error.message : "Unknown error";
  //     const errorResponse = { error: errorMessage };
  //     console.log("Sending HTML parse error response:", errorResponse);
  //     sendResponse(errorResponse);
  //   }

  //   console.log("Returning true from PARSE_HTML handler");
  //   return true;
  // }

  console.log("Unknown message type, returning false");
  return false;
});

// Clean up worker when offscreen document is unloaded
window.addEventListener("beforeunload", async () => {
  console.log("Offscreen document unloading, cleaning up worker");
  if (worker && isInitialized) {
    try {
      await worker.terminate();
      console.log("Worker terminated successfully");
    } catch (error) {
      console.error("Error terminating worker:", error);
    }
    worker = null;
    isInitialized = false;
  }
});

// Also handle the case when the document might be closed unexpectedly
window.addEventListener("pagehide", async () => {
  console.log("Offscreen document pagehide, cleaning up worker");
  if (worker && isInitialized) {
    try {
      await worker.terminate();
    } catch (error) {
      console.error("Error terminating worker:", error);
    }
    worker = null;
    isInitialized = false;
  }
});
