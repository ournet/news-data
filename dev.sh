#!/bin/bash

yarn remove @ournet/domain
yarn remove @ournet/news-domain
yarn remove dynamo-model

yarn link @ournet/domain
yarn link @ournet/news-domain
yarn link dynamo-model

yarn test
