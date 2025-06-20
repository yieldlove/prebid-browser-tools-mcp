const settings = {
    serverHost: 'localhost',
    serverPort: 3025
}

// Listen for memory heavy logs from the wrapper
window.addEventListener('message', (event) => {
  let serverUrl = ''

  if (event.data.type === 'bidRequest') {
    const { auctionId } = JSON.parse(event.data.payload)
    console.log('Received bidRequest', event.data);
    console.log('Received bidRequest payload', event.data.payload);

    serverUrl = `http://${settings.serverHost}:${settings.serverPort}/bid-requests/${auctionId}`;
  };

  if (!serverUrl) return;

  fetch(serverUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: event.data.payload
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      console.log('Response', response.json());
      return response.json();
    })
    .then((data) => {
      console.log("Log sent successfully:", data);
    })
    .catch((error) => {
      console.error("Error sending log:", error);
    });
  })