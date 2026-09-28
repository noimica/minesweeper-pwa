rm -rf ../work-report-gh-pages/*
cp -r dist/* ../work-report-gh-pages/
touch ../work-report-gh-pages/.nojekyll

cd ../work-report-gh-pages

git add .
git commit -m "Deploy"
git push