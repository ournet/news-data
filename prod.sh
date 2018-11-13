#!/bin/bash

yarn unlink @ournet/domain
yarn unlink @ournet/news-domain
yarn unlink dynamo-item

yarn add @ournet/domain
yarn add @ournet/news-domain
yarn add dynamo-item

yarn test
