document.addEventListener('DOMContentLoaded', async () => {
  const saveBtn = document.getElementById('save-btn');
  const statusDiv = document.getElementById('status');
  const urlDisplay = document.getElementById('url-display');

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab && tab.url) {
    urlDisplay.textContent = tab.title || tab.url;
    
    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      statusDiv.textContent = '';
      statusDiv.className = '';

      try {
        const response = await fetch('http://localhost:4000/api/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: tab.url,
            type: 'auto'
          }),
        });

        const data = await response.json();

        if (response.ok) {
          statusDiv.textContent = 'Saved successfully!';
          statusDiv.className = 'success';
          saveBtn.textContent = 'Saved';
          setTimeout(() => {
            window.close();
          }, 1500);
        } else {
          throw new Error(data.error || 'Failed to save');
        }
      } catch (error) {
        console.error('Save error:', error);
        statusDiv.textContent = 'Error: ' + error.message;
        statusDiv.className = 'error';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Try Again';
      }
    });
  } else {
    urlDisplay.textContent = 'Cannot save this page.';
    saveBtn.disabled = true;
  }
});
