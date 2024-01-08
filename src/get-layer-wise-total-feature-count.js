import sqlite3 from "sqlite3";
import zlib from "zlib";
import Pbf from "pbf";
import { VectorTile } from "@mapbox/vector-tile";
import { writeFileSync } from "fs";

function readMBTiles(mbtilesPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(mbtilesPath);

    db.serialize(() => {
      const metadata = {};

      // Read metadata from the database
      db.each("SELECT name, value FROM metadata", (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        metadata[row.name] = row.value;
      });

      // Read tile data from the database
      const tiles = [];
      db.each(
        "SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles ORDER BY zoom_level,tile_column,tile_row ASC",
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          tiles.push(row);
        },
        (err, count) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({ metadata, tiles });
        },
      );
    });

    db.close();
  });
}

// Replace 'path/to/your/file.mbtiles' with the actual path to your MBTiles file
const mbtilesPath = "input/planet.mbtiles";
const allData = [];
const allDataDummy = [];

// read mbtiles
readMBTiles(mbtilesPath)
  .then(({ metadata, tiles }) => {
    console.log("Metadata:", metadata);
    console.log("tile length", tiles.length);

    const writeData = async (csvData) => {
      try {
        writeFileSync(
          "output/get_layer_wise_total_feature_count.csv",
          csvData,
          {
            flag: "a+",
          },
        );
      } catch (error) {
        console.error("Error writing data", error);
      }
    };

    async function processTiles() {
      const layerWiseData = `layer_name, total_features\n`;
      writeData(layerWiseData);

      for (const tile of tiles) {
        const { zoom_level, tile_data } = tile;

        // Unzip and process the tile data
        await unzipTileData(tile_data, zoom_level);
      }

      allData.forEach((layerFeatures) => {
        const zoom_level_1 = layerFeatures.zoom;
        allDataDummy.push({
          zoom_level: zoom_level_1,
          layer_name: layerFeatures.layer_name.name,
          total_layer_features: layerFeatures.layer_name._features.length,
        });
      });

      // Create an array to store the totalLayerCount
      const totalLayerCount = [];

      // Iterate through the array and calculate the totalLayerCount
      for (const data of allDataDummy) {
        const { layer_name, total_layer_features } = data;
        const existingLayer = totalLayerCount.find(
          (layerData) => layerData.layer_name === layer_name,
        );

        // If the layer already exists, add the total_layer_features to the existing layer
        if (existingLayer) {
          existingLayer.total_layer_features += total_layer_features;
        } else {
          // If the layer does not exist, add the layer to the totalLayerCount array
          totalLayerCount.push({ layer_name, total_layer_features });
        }
      }

      //   write data to csv
      totalLayerCount.forEach((layer) => {
        const { layer_name, total_layer_features } = layer;
        const layerData = `${layer_name}, ${total_layer_features}\n`;
        writeData(layerData);
      });
    }

    async function unzipTileData(data, zoom_level) {
      return new Promise((resolve, reject) => {
        zlib.gunzip(data, (err, buffer) => {
          if (err) {
            console.log("zlib error", err.message);
            reject(err);
            return;
          }

          const data = new VectorTile(new Pbf(buffer));

          for (const layer in data.layers) {
            allData.push({
              zoom: zoom_level,
              layer_name: data.layers[layer],
              data: data.layers[layer]._features.length,
            });
          }

          resolve();
        });
      });
    }

    processTiles()
      .then(() => {
        console.log("CSV file written successfully!");
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  })
  .catch((error) => console.error("Error:", error));
