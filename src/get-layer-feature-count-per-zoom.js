import sqlite3 from 'sqlite3';
import zlib from 'zlib';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { writeFileSync } from 'fs';

function readMBTiles(mbtilesPath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(mbtilesPath);

    db.serialize(() => {
      const metadata = {};

      // Read metadata from the database
      db.each('SELECT name, value FROM metadata', (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        metadata[row.name] = row.value;
      });

      // Read tile data from the database
      const tiles = [];
      db.each(
        'SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles ORDER BY zoom_level,tile_column,tile_row ASC',
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
const featureLayerCountData = [];
const layerWiseData = [];
const mbtilesPath = 'input/planet.mbtiles';


readMBTiles(mbtilesPath)
  .then(({ metadata, tiles }) => {
    const writeData = async (csvData) => {
      try {
        writeFileSync('output/get_layer_feature_count_per_zoom.csv', csvData, {
          flag: 'a+',
        });
      } catch (error) {
        console.error('Error writing data', error);
      }
    };

    async function processTiles() {
      const tileDataCsv = `zoom, layer_name, total_features\n`;
      writeData(tileDataCsv);

      for (const tile of tiles) {
        const { zoom_level, tile_data } = tile;

        // Unzip and process the tile data
        await unzipTileData(tile_data, zoom_level);
      }

      featureLayerCountData.forEach((layerFeatures) => {
        layerWiseData.push({
          zoom_level: layerFeatures.zoom,
          layer_name: layerFeatures.layer_name.name,
          total_layer_features: layerFeatures.layer_name._features.length,
        });
      });

      // Create an array to store the zoomWiseLayerCount
      const zoomWiseLayerCount = [];

      for (const data of layerWiseData) {
        const getLayer = zoomWiseLayerCount.find(
          (layer) =>
            layer.zoom_level === data.zoom_level &&
            layer.layer_name === data.layer_name,
        );
        // If the layer already exists, add the feature count to the existing layer
        if (getLayer) {
          getLayer.total_layer_features += data.total_layer_features;
        } else {
          // If the layer does not exist, add the layer to the array
          zoomWiseLayerCount.push({
            zoom_level: data.zoom_level,
            layer_name: data.layer_name,
            total_layer_features: data.total_layer_features,
          });
        }
      }

      //   write data to csv
      zoomWiseLayerCount.forEach((layer) => {
        const { zoom_level, layer_name, total_layer_features } = layer;
        const layerData = `${zoom_level}, ${layer_name}, ${total_layer_features}\n`;
        writeData(layerData);
      });
    }

    async function unzipTileData(data, zoom_level) {
      return new Promise((resolve, reject) => {
        zlib.gunzip(data, (err, buffer) => {
          if (err) {
            console.log('zlib error', err.message);
            reject(err);
            return;
          }

          const data = new VectorTile(new Pbf(buffer));

          for (const layer in data.layers) {
            featureLayerCountData.push({
              zoom: zoom_level,
              layer_name: data.layers[layer],
              total_feature_count: data.layers[layer]._features.length,
            });
          }

          resolve();
        });
      });
    }

    processTiles()
      .then(() => {
        console.log('CSV file written successfully!');
      })
      .catch((error) => {
        console.error('Error:', error);
      });
  })
  .catch((error) => console.error('Error:', error));
