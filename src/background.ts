chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CAPTURE_SCREEN") {
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

  if (message.type === "SAVE_IMAGE") {
    console.log("[BACKGROUND] Saving image from data URL");

    chrome.downloads.download({
      url: message.dataUrl,
      filename: `screenshot_${Date.now()}.png`, // Add timestamp
      saveAs: false,
    });

    return true;
  }
});
