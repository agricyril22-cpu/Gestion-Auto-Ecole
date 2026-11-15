#!/usr/bin/env bash
# Assemble la vidéo finale : ./assemble.sh ordinateur.webm telephone.webm fin.webm
set -e
D="$1"; M="$2"; E="$3"; OUTF="$(dirname "$0")/demo-gestion-auto-ecole.mp4"
FB=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf; FR=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
ffmpeg -y -v error -ss 1.0 -i "$D" -ss 1.0 -i "$M" -ss 0.5 -i "$E" -filter_complex "\
[0:v]fps=30,scale=1280:720,setsar=1,format=yuv420p[a];\
[1:v]fps=30,scale=-2:672,pad=1280:720:800:24:color=0x2b3038,drawbox=x=788:y=12:w=338:h=696:color=0x111111:t=12,\
drawtext=fontfile=$FB:text='Sur téléphone et tablette':x=110:y=230:fontsize=46:fontcolor=white,\
drawbox=x=112:y=300:w=60:h=6:color=0xf2b705:t=fill,\
drawtext=fontfile=$FR:text='Installation depuis Chrome ou Safari':x=110:y=340:fontsize=26:fontcolor=0xc9d1db,\
drawtext=fontfile=$FR:text='Navigation adaptée au tactile':x=110:y=385:fontsize=26:fontcolor=0xc9d1db,\
drawtext=fontfile=$FR:text='Fonctionne sans connexion internet':x=110:y=430:fontsize=26:fontcolor=0xc9d1db,\
setsar=1,format=yuv420p[b];\
[2:v]fps=30,scale=1280:720,setsar=1,format=yuv420p[c];\
[a][b][c]concat=n=3:v=1:a=0,fade=t=in:st=0:d=0.6[v]" -map "[v]" -c:v libx264 -preset medium -crf 21 -movflags +faststart "$OUTF"
echo "$OUTF"
