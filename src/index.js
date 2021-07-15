// external packages
const express = require('express');
require('dotenv').config();
const axios = require('axios');

// Start the webapp
const webApp = express();

// Webapp settings
webApp.use(express.urlencoded({
    extended: true
}));
webApp.use(express.json());

// Server Port
const PORT = process.env.PORT || 5000;

// Home route
webApp.get('/', (req, res) => {
    res.send(`Hello World.!`);
});

const API_KEY = process.env.API_KEY;
const APP_ID = process.env.APP_ID;

// Get the user by sender_id
const getLocationInformation = async (location, guest) => {

    url = `htts://api.airtable.com/v0/${APP_ID}/ListingsAirbnbSheet?view=Grid%20view&filterByFormula=(AND({Location}="${location}", {guest}="${guest}"))&maxRecords=100`;
    headers = {
        Authorization: 'Bearer ' + API_KEY
    }

    try {

        let response = await axios.get(url, { headers });
        let records = response.data.records;
        if (records.length == 0) {
            return {
                status: 0
            }
        } else {
            return {
                status: 1,
                records: records
            }
        }

    } catch (error) {
        console.log(`Error at  getLocationInformation --> ${error}`);
        return {
            status: 0
        }
    }
};

// Handle Airtable Call
const handleAirtableCall = async (req) => {

    let outputContexts = req.body.queryResult.outputContexts;

    let location, people, price;

    outputContexts.forEach(outputContext => {
        let session = outputContext.name;
        if (session.includes('/contexts/session')) {
            if (outputContext.hasOwnProperty('parameters')) {
                location = outputContext.parameters.location;
                people = outputContext.parameters.people;
                price = outputContext.parameters.price;
            }
        }
    });

    let minPrice, maxPrice;

    if (Number(price) === 1) {
        minPrice = 0;
        maxPrice = 30;
    } else if (Number(price) === 2) {
        minPrice = 31;
        maxPrice = 80;
    } else {
        minPrice = 81;
        maxPrice = 500;
    }

    let airtableData = await getLocationInformation(location, people);

    let outString = '';

    if (airtableData.status === 0) {
        outString += `Mohon maaf, kami tidak dapat mencaikan kampu penginapaan dilokaasi tersebut.`;
    } else { //pengambilan data di airtable
        let records = airtableData.records;
        for (let index = 0; index < records.length; index++) {
            const record = records[index];
            let fields = record.fields;
            let recordPrice = 0;
            // Check the guest is equal than required
            if (Number(fields.guest) === Number(people)) {
                try {
                    recordPrice = Number(fields.price.split('$')[1]);
                } catch (error) {

                }
                // Check the price range
                if (Number(recordPrice) >= Number(minPrice) && Number(recordPrice) <= Number(maxPrice)) {
                    // This is where you format the string
                    if (fields.rating_n_reviews === 'empty') {
                        outString += `→  ${fields.name}.\n\n${fields.type}, ${fields.beds}, ${fields.bathrooms}, ${fields.facilities}. Not rated yet. \n\nHarga: ${fields.price}/malam\n\nBerikut link pemesanannya: http://airbnb.com${fields.url}\n`;
                        outString += '\n';
                    } else {
                        outString += `→ ${fields.name}.\n\n${fields.type}, ${fields.beds}, ${fields.bathrooms}, ${fields.facilities}. ★${fields.rating_n_reviews}. \n\nHarga: ${fields.price}/malam\n\nBerikut link pemesanannya: http://airbnb.com${fields.url}\n`;
                        outString += '\n';
                    }
                }
            }
        }
    }
// Fallback Answer if there is no listings at price range
    if (outString === '') {
        outString += `Mohon maaf, kami tidak memiliki penginapan di ${location} untuk ${people} orrang di range harga ${minPrice}$ sampai dengan ${maxPrice}$.\nApakah ada preferensi harga lain yang kamu inginkan? Mohon tulis ulang opsi harga mana yang anda iginkan.\n(1) 0$ sampai dengan 30$\n(2) 31$ sampai dengan 80$\n(3) 81$ sampai dengan tak terrhingga.`;
        let session = req.body.session;
        let awaitPrice = `${session}/contexts/await-price`
        return {
            fulfillmentText: outString,
            outputContexts: [
                {
                    name: awaitPrice,
                    lifespanCount: 1,
                }
            ]
        }
    } else {
        return {
            fulfillmentText: outString
        };
    }
};

// Webhook route
webApp.post('/webhook', async (req, res) => {

    let action = req.body.queryResult.action;
    let session = req.body.session;
    console.log('Webhook called.');
    console.log(`Action --> ${action}`);
    console.log(`Session --> ${session}`);

    let responseData = {};

    if (action === 'handleAirtableCall') {
        responseData = await handleAirtableCall(req);
    } else {
        responseData = {
            fulfillmentText: 'No action is set for this intent.'
        };
    }

    res.send(responseData);
});

// Start the server
webApp.listen(PORT, () => {
    console.log(`Server is up and running at ${PORT}`);
});