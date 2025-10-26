// Instrucciones para desplegar el contrato MerkleAnchor en Sepolia usando Hardhat

1. Instala Hardhat y dependencias:

   npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers

2. Inicializa Hardhat (elige "Create an empty hardhat.config.js"):

   npx hardhat init

3. Copia el contrato `MerkleAnchor.sol` a la carpeta `contracts/`.

4. Agrega la siguiente configuración a tu `hardhat.config.js`:

```js
require("@nomiclabs/hardhat-ethers");
module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.ETHEREUM_RPC_URL,
      accounts: [process.env.ETHEREUM_PRIVATE_KEY]
    }
  }
};
```

5. Crea un script de despliegue en `scripts/deploy.js`:

```js
async function main() {
  const MerkleAnchor = await ethers.getContractFactory("MerkleAnchor");
  const contract = await MerkleAnchor.deploy();
  await contract.deployed();
  console.log("MerkleAnchor deployed to:", contract.address);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

6. Despliega el contrato en Sepolia:

   npx hardhat run scripts/deploy.js --network sepolia

7. Copia la dirección que imprime el script y agrégala a tu `.env` como:

   ETHEREUM_ANCHOR_CONTRACT=0x...

---

¿Listo para continuar con la integración backend?
