"use strict";

const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const UglifyJSPlugin = require("uglifyjs-webpack-plugin");

module.exports = (env = {}) => {
    let mode = env.production ? "production" : "development";

    let devtool = env.production ? "source-map" : "inline-source-map";

    let devServer = env.production
        ? undefined
        : {
              contentBase: "./dist",
              hot: true
          };

    let plugins = [
        new CleanWebpackPlugin(["dist"], {verbose: true}),
        new HtmlWebpackPlugin({
            title: "Output Management",
            filename: "index.html",
            inject: "head",
            template: "./template/index.html"
        })
    ];

    plugins = env.production
        ? plugins.concat([
              new UglifyJSPlugin({sourceMap: true}),
              new webpack.DefinePlugin({
                  "process.env.NODE_ENV": JSON.stringify("production")
              })
          ])
        : plugins.concat([new webpack.NamedModulesPlugin(), new webpack.HotModuleReplacementPlugin()]);

    return {
        mode: mode,
        entry: "./lib/jsdap.js",
        devtool: devtool,
        devServer: devServer,
        module: {
            rules: [
                {
                    test: /\.js$/,
                    exclude: /(node_modules|bower_components)/,
                    use: {
                        loader: "babel-loader",
                        options: {
                            cacheDirectory: path.resolve(__dirname, ".cache", "babel")
                            // presets: [['env', {modules: false}]]
                        }
                    }
                }
            ]
        },
        plugins: plugins,
        output: {
            path: path.resolve(__dirname, "./dist"),
            filename: "jsdap.js",
            libraryTarget: "umd",
            // libraryExport: 'default',
            library: "jsdap"
        }
    };
};
