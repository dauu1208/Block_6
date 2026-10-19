const app = require("./app");
const { sequelize } = require("./models");

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await sequelize.authenticate();
    // Code-first: bảng được tạo từ model (chưa có thì tạo, có rồi thì giữ nguyên)
    await sequelize.sync();
    app.listen(PORT, () =>
      console.log(`Server chạy tại http://localhost:${PORT}`),
    );
  } catch (err) {
    console.error("Không kết nối được database:", err.message);
    process.exit(1);
  }
})();
