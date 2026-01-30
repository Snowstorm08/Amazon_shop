const express = require("express");
const bodyParser = require("body-parser");
const SellingPartner = require("amazon-sp-api");
const XLSX = require("xlsx");
const csv = require("csv-parser");
const fs = require("fs");
const cron = require("node-cron");

const Product = require("../models/Product");
const NgData = require("../models/NgData");
const AddPrice = require("../models/AddPrice");
const loadstate = require("../models/loadstate");
const price = require("../models/price");
const User = require("../models/User");
const { updatePrice, UpdateMydbOfQoo10 } = require("./qoo10ProductManage");

require("dotenv").config({ path: `../` });

const app = express();
app.use(bodyParser.json());

/** ---------------------
 * SP API Client Helper
 * --------------------- */
let spClient;

async function getSPClient() {
  if (!spClient) {
    const client = new SellingPartner({
      region: "fe",
      refresh_token: process.env.REFRESH_TOKEN,
      credentials: {
        SELLING_PARTNER_APP_CLIENT_ID: process.env.CLIENT_ID,
        SELLING_PARTNER_APP_CLIENT_SECRET: process.env.CLIENT_SECRET,
      },
    });
    await client.refreshAccessToken();
    spClient = client;
  }
  return spClient;
}

/** ---------------------
 * Normalize Catalog Item
 * --------------------- */
function normalizeCatalogItem(item) {
  return {
    title: item.summaries[0]?.itemName || "",
    quantity:
      item.attributes.unit_count?.[0]?.value ||
      item.attributes.number_of_items?.[0]?.value ||
      item.attributes.number_of_boxes?.[0]?.value ||
      -1,
    images: item.images[0]?.images || [],
    description:
      item.attributes.product_description?.[0]?.value ||
      (item.attributes.bullet_point
        ? item.attributes.bullet_point.map((bp) => bp.value).join(" ")
        : ""),
    bullet_point: item.attributes.bullet_point || [],
    package: item.dimensions[0]?.package || "",
    brand: item.summaries[0]?.brand || "",
    part_number: item.summaries[0]?.part_number || "",
    manufacturer: item.summaries[0]?.manufacturer || "",
    releaseDate: item.summaries[0]?.releaseDate || "",
    AdultYN: item.summaries[0]?.adultProduct || false,
  };
}

/** ---------------------
 * Get Amazon Product
 * --------------------- */
async function getAmazonProduct(asin) {
  try {
    const client = await getSPClient();
    const catalog_item = await client.callAPI({
      operation: "getCatalogItem",
      endpoint: "catalogItems",
      path: { asin },
      query: {
        marketplaceIds: "A1VC38T7YXB528",
        includedData: "attributes,dimensions,images,summaries",
        locale: "ja_JP",
      },
      options: { version: "2022-04-01" },
    });

    if (!catalog_item) return null;

    return {
      ...catalog_item,
      quantity: normalizeCatalogItem(catalog_item).quantity,
    };
  } catch (err) {
    console.error("getAmazonProduct error:", err);
    return null;
  }
}

/** ---------------------
 * Add Product to DB
 * --------------------- */
async function addProductToMydbBasic(asin, userId) {
  const catalog_item = await getAmazonProduct(asin);
  if (!catalog_item)
    return { state: "asin code error", product: null };

  const quantity = normalizeCatalogItem(catalog_item).quantity;
  if (quantity < 1)
    return { state: "quantify is not enough", product: null };

  const prices = await price.find({ userId, ASIN: asin });
  const list_price =
    prices[0]?.Product?.CompetitivePricing.CompetitivePrices?.[0]
      ?.Price?.LandedPrice?.Amount || 1300;

  const normalized = normalizeCatalogItem(catalog_item);
  const product = new Product({
    asin,
    userId,
    title: normalized.title,
    SecondSubCat: null,
    amaparentCat: "",
    amaCat: "",
    qoo10_img: normalized.images[0]?.link || "",
    img: normalized.images,
    description: normalized.description,
    price: list_price,
    qoo10_price: null,
    predictableIncome: null,
    bullet_point: normalized.bullet_point,
    quantity,
    package: normalized.package,
    brand: normalized.brand,
    part_number: normalized.part_number,
    manufacturer: normalized.manufacturer,
    releaseDate: normalized.releaseDate,
    AdultYN: normalized.AdultYN,
  });

  await product.save();
  return { state: "ok", product };
}

/** ---------------------
 * Define Price for ASINs
 * --------------------- */
async function definePrice(asins, userId, number) {
  try {
    const client = await getSPClient();
    const res = await client.callAPI({
      operation: "getCompetitivePr
