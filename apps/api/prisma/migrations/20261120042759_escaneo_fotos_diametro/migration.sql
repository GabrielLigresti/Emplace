-- Escaneo con fotos: la carpeta de las fotos reemplaza al archivo de video.
ALTER TABLE "escaneo_plato" RENAME COLUMN "ruta_video" TO "ruta_fotos";

-- Diámetro del plato, obligatorio para escanearlo.
ALTER TABLE "item_menu" ADD COLUMN "diametro_cm" DECIMAL(4,1);
