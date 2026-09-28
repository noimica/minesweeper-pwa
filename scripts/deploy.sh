rm -rf ../minesweeper-gh-pages/*
cp -r dist/* ../minesweeper-gh-pages/
touch ../minesweeper-gh-pages/.nojekyll

cd ../minesweeper-gh-pages

git add .
git commit -m "Deploy"
git push