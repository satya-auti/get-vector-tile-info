import sqlite3 from "sqlite3";
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
      //   get zoom_level, tile_column, tile_row, tile_data, tile_length_in_kb (size of tile_data column) data order by zoom_level, tile_column, tile_row
      db.each(
        "SELECT zoom_level, tile_column, tile_row, tile_data, length(tile_data)/1024.0 as tile_length_in_kb FROM tiles ORDER BY zoom_level,tile_column,tile_row ASC",
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

const sortedTiles = [];

readMBTiles(mbtilesPath)
  .then(({ metadata, tiles }) => {
    console.log("Metadata:", metadata);
    console.log("tile length", tiles.length);

    const writeData = async (csvData) => {
      try {
        writeFileSync("output/get_tiles_min_max_size_zoom_wise.csv", csvData, {
          flag: "a+",
        });
      } catch (error) {
        console.error("Error writing data", error);
      }
    };

    async function processTiles() {
      const csvData = `zoom_level, tiles, minimun_tile_size_in_kb, maximum_tile_size_in_kb\n`;
      writeData(csvData);
      const zoomLevels = new Set();

      for (const tile of tiles) {
        const { zoom_level } = tile;
        zoomLevels.add(zoom_level);
        await unzipTileData(zoom_level, tile);
      }

      const sortedZoom = [];
      for (const zoomLevel of zoomLevels) {
        const sizes = tiles
          .filter((tile) => tile.zoom_level === zoomLevel)
          .map((tile) => tile.size);
        const minSize = Math.min(...sizes);
        const maxSize = Math.max(...sizes);

        const tileSizeData = {
          zoom_level: zoomLevel,
          minimum_size: `${minSize.toFixed(2)} KB`,
          maximum_size: `${maxSize.toFixed(2)} KB`,
        };
        sortedZoom.push(tileSizeData);
      }

      //   Sort ascending order of zoom level and write to csv
      sortedZoom.sort((a, b) => a.zoom_level - b.zoom_level);
      sortedZoom.map((tileData) => {
        const csvData = `${tileData.zoom_level}, ${
          sortedTiles[tileData.zoom_level]
        }, ${tileData.minimum_size}, ${tileData.maximum_size}\n`;
        writeData(csvData);
      });
    }

    async function unzipTileData(zoom_level, tile) {
      return new Promise((resolve, reject) => {
        if (!tile.tile_length_in_kb) {
          reject();
          return;
        }

        if (sortedTiles[zoom_level]) {
          sortedTiles[zoom_level]++;
        } else {
          sortedTiles[zoom_level] = 1;
        }

        const size = tile.tile_length_in_kb; // Get the size of the tile
        tile.size = size; // Assign the size to the tile object

        resolve();
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
