// const yahooFinance = require("yahoo-finance2").default;

// setInterval(
//   (start = async () => {
//     const quote = await yahooFinance.quote("reliance.ns");
//     // const { regularMarketPrice as price, currency } = quote;
//     console.log(quote.regularMarketPrice);
//     console.log(quote.priceToBook);
//   }),
//   2000
// );

const express = require("express");
const yahooFinance = require("yahoo-finance2").default;
const cors = require("cors");

const app = express();
const port = 3002;

// Enable CORS
app.use(cors());

// app.get("/api/stock-price", async (req, res) => {
//   try {
//     const symbols = req.query.symbols;
//     const quote = await yahooFinance.quote(symbols + ".BO");
//     const price = quote.regularMarketPrice;
//     res.json({ price });
//   } catch (error) {
//     console.error("Error fetching stock price:", error);
//     res.status(500).json({ error: "Internal Server Error single" });
//   }
// });

app.get("/server2/current-prices", async (req, res) => {
  try {
    const orderList = req.query.orderList; // symbols will be an array of symbols
    const serverOrderList = [];

    for (const transaction of orderList) {
      //console.log(transaction.symbol);
      const quote = await yahooFinance.quote(transaction.symbol + ".BO");
      const modifiedTransaction = {
        ...transaction,
        serverCurrentPrice: quote.regularMarketPrice,
      };
      serverOrderList.push(modifiedTransaction);
    }
    console.log(serverOrderList);
    res.json(serverOrderList);
    // console.log("server 2 got connected", orderList);
  } catch (error) {
    console.error("Error fetching current prices:", error);
    res.status(500).json({ error: "Internal Server Error group" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
