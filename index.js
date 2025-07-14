const express = require('express');
const { Firestore } = require("@google-cloud/firestore");
const { Logging } = require('@google-cloud/logging');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
const logName = "gcp-recargas-saldos-log";

// Creates a Logging client
const logging = new Logging();
const log = logging.log(logName);

// Initialize Firestore once at startup with proper scopes
const db = new Firestore({
    projectId: "my-project-1571074190064",
    databaseId: "gcp-recargas-db" // Specify the database ID here
    // Other options:
    // databaseId: "(default)",
    // Explicitly specify scopes if needed
    // This ensures the client has the right permissions
});

const resource = {
    type: "global",
};

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('Listening on port', port);
});

app.post('/', async (req, res) => {
  console.log(`Received request body:`, JSON.stringify(req.body, null, 2));
  const recarga = decodeBase64Json(req.body.message.data);
  try {
    console.log(`GCP Saldo Service: Processing saldo update for ${recarga.telefono} trying...`);
    await saveRegistro(recarga);
    console.log(`GCP Saldo Service: Saldo update for ${recarga.telefono} success :-)`);
    res.status(204).send();
  }
  catch (ex) {
    console.log(`GCP Saldo Service: Saldo update for ${recarga?.telefono || 'unknown'} failure: ${ex}`);
    console.error('Full error details:', ex);
    
    res.status(500).send({ error: 'Internal server error', message: ex.message });
  }
})

async function saveRegistro(recarga) {
  try {
      console.log(`Recarga data received:`, JSON.stringify(recarga, null, 2));
      
      // Validate required fields
      if (!recarga || typeof recarga !== 'object') {
        throw new Error('Invalid recarga data: must be an object');
      }
      
      if (!recarga.telefono || recarga.telefono.trim() === '') {
        throw new Error(`Invalid telefono: ${recarga.telefono}. Must be non-empty.`);
      }
      
      if (!recarga.monto) {
        throw new Error(`Invalid monto: ${recarga.monto}. Must be provided.`);
      }
      
      await writeToFirestore(recarga);
      // A text log entry
      const success_message = `Success: Saldo updated for ${recarga.telefono} - Added ${recarga.monto} to balance`;
      const entry = log.entry(
        { resource: resource },
        { message: `${success_message}` }
      );
      log.write([entry]);
    } catch (e) {
      console.error(e);
      throw e; // Re-throw to be handled by the calling function
    }
}

async function writeToFirestore(recarga) {
    console.log(`writeToFirestore called with:`, JSON.stringify(recarga, null, 2));
    
    const docRef = db.collection("saldos").doc(recarga.telefono);
    
    try {
        // First, read the existing document to get current saldo
        const doc = await docRef.get();
        let currentSaldo = 0;
        
        if (doc.exists) {
            const docData = doc.data();
            currentSaldo = docData.saldo || 0;
            console.log(`Current saldo for ${recarga.telefono}: ${currentSaldo}`);
        } else {
            console.log(`No existing saldo found for ${recarga.telefono}, starting with 0`);
        }
        
        // Calculate new saldo by adding the recarga amount
        const newSaldo = currentSaldo + parseInt(recarga.monto);
        console.log(`New saldo will be: ${currentSaldo} + ${recarga.monto} = ${newSaldo}`);
        
        // Prepare data to save
        const data = {
            telefono: recarga.telefono,
            saldo: newSaldo,
            lastUpdated: new Date().toISOString()
        };

        console.log(`Data to be saved:`, JSON.stringify(data, null, 2));

        // Save the updated saldo
        await docRef.set(data, { merge: true });
        console.log(`Saldo updated successfully for ${recarga.telefono}. New balance: ${newSaldo}`);
        
    } catch (err) {
        console.log(`Error saving saldo: ${err}`);
        throw err; // Re-throw to be handled by the calling function
    }
}

function decodeBase64Json(data) {
  return JSON.parse(Buffer.from(data, 'base64').toString());
}
