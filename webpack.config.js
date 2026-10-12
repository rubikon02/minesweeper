const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/index.js',
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    devtool: 'source-map',
    mode: 'development',
    devServer: {
        port: 8080,
        hot: true,
        open: false,
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: 'index.html',
            title: "3D Minesweeper",
            template: './src/index.html',
        }),
    ],
    module: {
        rules: [
            {
                test: /\.(mtl|obj)$/i,
                type: 'asset/resource',
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(png|jpe?g|svg|ico)$/i,
                type: 'asset',
                parser: {
                    dataUrlCondition: {
                        maxSize: 8192,
                    },
                },
            },
        ],
    },
};