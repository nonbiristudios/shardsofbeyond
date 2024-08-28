FONTS_FOLDER="${FONTS_FOLDER:=./fonts/}"

mv "${FONTS_FOLDER}/*" "/usr/share/fonts/"
fc-cache -fv