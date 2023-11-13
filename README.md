# Derp and xDerp

### Deploy Derp


```shell
# Deploy Derp to Base chain
yarn hardhat compile && yarn hardhat run scripts/deployDerp.js --network base

# Deploy Derp to opBNB
yarn hardhat compile && yarn hardhat run scripts/deployDerp.js --network opBnb
```


### Deploy xDerp

```shell

# Deploy xDerp to Base Testnet
yarn hardhat compile && yarn hardhat run scripts/deployTestnet.js --network baseTestnet

# Deploy xDerp to opBNB Testnet
yarn hardhat compile && yarn hardhat run scripts/deployTestnet.js --network opBnbTestnet
```