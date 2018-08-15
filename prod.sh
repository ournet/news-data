#!/bin/bash

yarn unlink @ournet/domain
yarn unlink @ournet/news-domain
yarn unlink dynamo-model

yarn add @ournet/domain
yarn add @ournet/news-domain
yarn add dynamo-model

yarn test
