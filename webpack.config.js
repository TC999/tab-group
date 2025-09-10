import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: {
    popup: './src/js/popup.ts',
    sw: './src/js/sw.ts',
    rules: './src/js/rules.ts',
    help: './src/js/help.ts',
    import: './src/js/import.ts',
    'group-store': './src/js/group-store.ts',
    'rule-store': './src/js/rule-store.ts'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'src/manifest.json',
          to: 'manifest.json'
        },
        {
          from: 'src/icon/**/*',
          to: 'icon/[name][ext]'
        },
        {
          from: 'src/img/**/*',
          to: 'img/[name][ext]'
        },
        {
          from: 'src/_locales/**/*',
          to: '_locales/[path][name][ext]'
        },
        {
          from: 'src/help/**/*',
          to: 'help/[path][name][ext]'
        },
        {
          from: 'src/css/**/*.css',
          to: 'css/[name][ext]'
        },
        {
          from: 'src/jslib/**/*',
          to: 'jslib/[name][ext]'
        },
        {
          from: 'src/img/**/*',
          to: 'img/[name][ext]'
        }
      ]
    }),
    new HtmlWebpackPlugin({
      template: 'src/popup.html',
      filename: 'popup.html',
      chunks: ['popup']
    }),
    new HtmlWebpackPlugin({
      template: 'src/rules.html',
      filename: 'rules.html',
      chunks: ['rules']
    }),
    new HtmlWebpackPlugin({
      template: 'src/help.html',
      filename: 'help.html',
      chunks: ['help']
    }),
    new HtmlWebpackPlugin({
      template: 'src/import.html',
      filename: 'import.html',
      chunks: ['import']
    })
  ]
};