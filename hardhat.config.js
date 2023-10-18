require("dotenv").config();
require('@openzeppelin/hardhat-upgrades');
require("@nomicfoundation/hardhat-toolbox");
require('hardhat-deploy');


/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.10",

  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
      // forking: {
      // url: process.env.mainnet_rpc
      // }
    },
    baseGoerli: {
      url: `https://goerli.base.org`,
      accounts: [process.env.deployer_priv_key],
    },
    base: {
      url: `https://mainnet.base.org`,
      accounts: [process.env.deployer_priv_key],
    },
    opBnbTestnet: {
      url: `https://opbnb-testnet-rpc.bnbchain.org`,
      chainId: 5611,
      accounts: [process.env.deployer_priv_key],
    },
    opBnb: {
      url: `https://opbnb-mainnet-rpc.bnbchain.org`,
      chainId: 204,
      accounts: [process.env.deployer_priv_key],
    }
  },
  etherscan: {
    apiKey: {
      baseGoerli: "PLACEHOLDER_STRING",
      base: process.env.ETHERSCAN_API_KEY,
      opBnbTestnet: process.env.opBNB_API_KEY,
      opBnb: process.env.opBNB_API_KEY
    },
    customChains: [
      {
        network: 'baseGoerli',
        urls: {
          apiURL: "https://api-goerli.basescan.org/api",
          browserURL: "https://goerli.basescan.org"
        }
      },
      {
        network: 'base',
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      },
      {
        network: 'opBnbTestnet',
        chainId: 5611,
        urls: {
          apiURL: `https://open-platform.nodereal.io/${process.env.opBNB_API_KEY}/op-bnb-testnet/contract/`,
          browserURL: "https://opbnbscan.com"
        }
      },
      {
        network: 'opBnb',
        chainId: 204,
        urls: {
          apiURL: `https://open-platform.nodereal.io/${process.env.opBNB_API_KEY}/op-bnb-mainnet/contract/`,
          browserURL: "https://opbnbscan.com"
        }
      }
    ]
  },
};
