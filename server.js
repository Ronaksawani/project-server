const express = require("express");
const yahooFinance = require("yahoo-finance2").default;
const cors = require("cors");
const admin = require("firebase-admin");
const serviceAccount = require("./dailypunch-76518-firebase-adminsdk-6i4bj-7b8b24bd2a.json");
const cron = require("node-cron");

const app = express();
const port = 3002;

// Enable CORS
app.use(cors());
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function getAllDocuments() {
  try {
    const collectionRef = db.collection("users");
    const snapshot = await collectionRef.get();

    snapshot.forEach(async (doc) => {
      console.log(doc.id, " => ", doc.data());

      // Get current margin_chart data from Firestore
      const existingMarginChart = doc.data().marginChart || [];

      // Get margin_available and current timestamp
      const marginAvailable = doc.data().margin_available;
      const currentTime = Math.floor(Date.now() / 1000);

      // Create updated margin_chart array
      const updatedMarginChart = [
        ...existingMarginChart,
        { value: marginAvailable, time: currentTime },
      ];

      // Define the document reference
      const docRef = db.collection("users").doc(doc.id);

      // Update margin_chart in Firestore
      await docRef.update({ marginChart: updatedMarginChart });
      console.log("Margin chart updated successfully!");
    });
  } catch (error) {
    console.error("Error getting documents:", error);
  }
}

// Schedule the function to run at 3:31 PM every day
cron.schedule(
  "31 15 * * *",
  () => {
    console.log("Running getAllDocuments() at 3:31 PM");
    getAllDocuments();
  },
  {
    timezone: "Asia/Kolkata", // Change the timezone if necessary
  }
);

// Main function to determine whether to use today's date or yesterday's date
function getDateUse() {
  const now = new Date();
  console.log("Current time:", now.toISOString()); // Log current time for debugging
  const marketOpenTime = new Date(now);
  marketOpenTime.setUTCHours(3, 45, 0, 0); // Set to 9:15 AM UTC
  console.log("Market open time:", marketOpenTime.toISOString()); // Log market open time for debugging
  if (
    now.getUTCHours() > 3 ||
    (now.getUTCHours() === 3 && now.getUTCMinutes() >= 45)
  ) {
    // If current time is after 9:15 AM UTC, use today's date
    console.log("Using today's date");
    return getTodayDate();
  } else {
    // Otherwise, use yesterday's date
    console.log("Using yesterday's date");
    return getYesterdayDate();
  }
}

//getDateUse();

// Function to get today's date in UTC
function getTodayDate() {
  const today = new Date();
  return new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  );
}

// Function to get yesterday's date in UTC
function getYesterdayDate() {
  const today = getTodayDate();
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);
  return yesterday;
}

// Main function to determine whether to use today's date or yesterday's date
function getDateToUse() {
  const now = new Date();
  const marketOpenTime = new Date(now);
  marketOpenTime.setUTCHours(3, 45, 0, 0); // Set to 9:15 AM UTC
  if (now < marketOpenTime) {
    // If current time is before 9:15 AM UTC, use yesterday's date
    return getYesterdayDate();
  } else {
    // Otherwise, use today's date
    return getTodayDate();
  }
}

// Function to format date to YYYY-MM-DD
function formatDateToYYYYMMDD(date) {
  return `${date.getFullYear()}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}

// Example usage
const dateToUse = getDateToUse();
const formattedDate = formatDateToYYYYMMDD(dateToUse);
console.log("Date to use:", formattedDate);

app.get("/", async (req,res) => {
  res.send("hello")
});

app.get("/chart/ohlc", async (req, res) => {
  try {
    var quote;
    const symbol = req.query.symbol.toUpperCase();
    console.log(symbol);
    const quote1 = await yahooFinance.chart(symbol + ".NS", {
      period1: "2024-02-19",
      return: "object",
      interval: "2m",
    });
    quote = quote1;
    if (
      !quote1 ||
      !quote1.indicators ||
      !quote1.indicators.quote ||
      !quote1.timestamp
    ) {
      console.log("Quote data is empty, using yesterday's date.");
      // Use yesterday's date if quote data is empty
      const yesterday = getYesterdayDate();
      const formattedYesterday = formatDateToYYYYMMDD(yesterday);
      const quote1 = await yahooFinance.chart(symbol + ".NS", {
        period1: formattedYesterday,
        return: "object",
        interval: "1m",
      });
      quote = quote1;
    }
    const timestamps = quote.timestamp;
    const ohlc = quote.indicators.quote;
    console.log(ohlc);

    // Format the data
    const formattedData = timestamps.map((timestamp, index) => ({
      time: timestamp + 19800,
      open: ohlc[0].open[index], // Convert to float before formatting
      high: ohlc[0].high[index],
      low: ohlc[0].low[index],
      close: ohlc[0].close[index],
    }));

    // Send the formatted data as JSON response
    res.json(formattedData);

    // Logging for debugging
    console.log(formattedData);
  } catch (error) {
    console.log("Error fetching chart data", error);
    // Handle the error as needed
    // res.status(500).json({ error: "Yahoo server error" });
  }
});

//}
//);

app.get("/api/stock-price", async (req, res) => {
  try {
    const symbols = req.query.symbols;
    const quote = await yahooFinance.quote(symbols + ".NS");
    const price = parseFloat(quote.regularMarketPrice).toFixed(2);
    res.json({ price });
  } catch (error) {
    console.error("Error fetching stock price:", error);
    res.status(500).json({ error: "Internal Server Error single" });
  }
});

app.get("/server2/current-prices", async (req, res) => {
  try {
    const orderList = req.query.orderList; // symbols will be an array of symbols
    const serverOrderList = [];

    for (const transaction of orderList) {
      //console.log(transaction.symbol);
      const quote = await yahooFinance.quote(transaction.symbol + ".NS");
      const modifiedTransaction = {
        ...transaction,
        serverCurrentPrice: parseFloat(quote.regularMarketPrice).toFixed(2),
      };
      serverOrderList.push(modifiedTransaction);
    }
    //console.log(serverOrderList);
    res.json(serverOrderList);
    // console.log("server 2 got connected", orderList);
  } catch (error) {
    console.error("Error fetching current prices:", error);
    res.status(500).json({ error: "Internal Server Error group" });
  }
});

app.get("/watchlist/current-prices", async (req, res) => {
  try {
    const watchList = req.query.watchlist; // symbols will be an array of symbols
    const serverwatchList = [];
    // console.log(watchList);
    for (const transaction of watchList) {
      //console.log(transaction.symbol);
      console.log(transaction.symbol);
      const quote = await yahooFinance.quote(transaction.symbol + ".NS");

      const modifiedTransaction = {
        ...transaction,
        serverCurrentPrice: parseFloat(quote.regularMarketPrice).toFixed(2),
        serverMarketChange: parseFloat(quote.regularMarketChange).toFixed(2),
        serverMarketChangePercent: parseFloat(
          quote.regularMarketChangePercent
        ).toFixed(2),
      };
      serverwatchList.push(modifiedTransaction);
    }
    //console.log(serverOrderList);
    res.json(serverwatchList);
    // console.log("server 2 got connected", orderList);
  } catch (error) {
    console.error("Error fetching current watchlist prices:", error);
    res.status(500).json({ error: "Internal Server Error group" });
  }
});

// Define market status logic
function getMarketStatus() {
  const currentDate = new Date();
  const dayOfWeek = currentDate.getDay(); // Sunday is 0, Saturday is 6

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return "Closed";
  }

  const currentHour = currentDate.getHours();
  const currentMinute = currentDate.getMinutes();
  const marketOpenHour = 9;
  const marketCloseHour = 15;

  if (
    currentHour > marketOpenHour ||
    (currentHour === marketOpenHour && currentMinute >= 15) // Assuming market opens at 9:15 AM
  ) {
    if (
      currentHour < marketCloseHour ||
      (currentHour === marketCloseHour && currentMinute <= 30) // Assuming market closes at 3:30 PM
    ) {
      return "Open";
    }
  }

  return "Closed";
}

// Define API endpoint to get market status
app.get("/api/market-status", (req, res) => {
  const marketStatus = getMarketStatus();
  res.json({ status: marketStatus });
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
