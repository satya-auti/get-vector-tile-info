import zlib from "zlib";
import Pbf from "pbf";
import { VectorTile } from "@mapbox/vector-tile";
import { writeFileSync } from "fs";
import sqlite3 from "sqlite3";

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

      // get tile data from the database
      const tiles = [];
      //   get data order by zoom_level, tile_column, tile_row
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

readMBTiles(mbtilesPath)
  .then(({ metadata, tiles }) => {
    console.log("Metadata:", metadata);
    console.log("tile length", tiles.length);

    // Write data to CSV file
    const writeData = async (csvData) => {
      try {
        writeFileSync("output/total_features_per_tile.csv", csvData, {
          flag: "a+",
        });
      } catch (error) {
        console.error("Error writing data", error);
      }
    };

    async function processTiles() {
      const tileDataCsv = `zoom, tile_column, tile_row, layer_name, layer_count, total_features\n`;
      writeData(tileDataCsv);

      for (const tile of tiles) {
        const { zoom_level, tile_column, tile_row, tile_data } = tile;
        const calculatedTileRow = Math.pow(2, zoom_level) - tile_row - 1;

        await unzipTileData(
          tile_data,
          zoom_level,
          tile_column,
          calculatedTileRow,
        );
      }
    }

    async function unzipTileData(data, zoom_level, tile_column, tile_row) {
      return new Promise((resolve, reject) => {
        zlib.gunzip(data, (err, buffer) => {
          if (err) {
            console.log("zlib error", err.message);
            reject(err);
            return;
          }

          const data = new VectorTile(new Pbf(buffer));
          var totalFeatureData = 0;

          for (const layer in data.layers) {
            totalFeatureData += data.layers[layer]._features.length;
          }

          //   get layer name total features in layer
          for (const layer in data.layers) {
            const tileDataCsv = `${zoom_level}, ${tile_column}, ${tile_row}, ${data.layers[layer].name}, ${data.layers[layer]._features.length}, ${totalFeatureData}\n`;
            // write data to csv file
            writeData(tileDataCsv);
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
