import prismaClient from '../../src/database';
import request from 'supertest';
import testUserData from '../data/user.json';
import testClientData from '../data/client.json';
import app from '../../src/app';
import fs from 'fs';
import cookie from 'cookie';
import { sessionIdName } from '../../src/config/session.config';
import { servingURL } from '../../src/config/path.config';

jest.unmock('../../src/database');

describe('Client API', () => {
  const currentUser: Record<string, any> = {
    ...testUserData.users[0],
    password: 'StrongPassword12!',
  };

  beforeAll(async () => {
    for (const user of testUserData.users) {
      await prismaClient.user.create({
        data: user,
      });
    }

    const res = await request(app)
      .post('/auth/login')
      .set({
        'Content-Type': 'application/x-www-form-urlencoded',
      })
      .send({
        email: currentUser.email,
        password: currentUser.password,
        continue: 'http://example.com',
      });

    expect(res.statusCode).toEqual(302);
    expect(res.redirect).toEqual(true);

    const cookieStrings = res.headers['set-cookie'];
    let sidCookie = '';

    for (const cookieString of cookieStrings) {
      const _cookie = cookie.parse(cookieString);
      if (Object.keys(_cookie).includes(sessionIdName)) {
        sidCookie = cookie.serialize(sessionIdName, _cookie._dev_sid);
      }
    }

    expect(sidCookie).not.toBe('');

    currentUser.sidCookie = sidCookie;

    for (const client of testClientData.clients) {
      await prismaClient.oauth_client.create({
        data: client,
      });
    }

    for (const otherClient of testClientData.clientsOfOtherUser) {
      await prismaClient.oauth_client.create({
        data: otherClient,
      });
    }
  });

  afterAll(async () => {
    await prismaClient.user.deleteMany({});
    await prismaClient.oauth_client.deleteMany({});
  });

  describe('GETS', () => {
    test('Response_Clients_With_200', async () => {
      const res = await request(app)
        .get('/app')
        .set('Cookie', currentUser.sidCookie);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(testClientData.publicClientsInfo);
    });
  });

  describe('GET', () => {
    test('Response_Client_With_200', async () => {
      const res = await request(app)
        .get(`/app/${testClientData.clients[0].client_id}`)
        .set('Cookie', currentUser.sidCookie);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(testClientData.clients[0]);
    });

    test('Response_404_clientId(not_authorized)', async () => {
      const res = await request(app)
        .get(`/app/${testClientData.clientsOfOtherUser[0].client_id}`)
        .set('Cookie', currentUser.sidCookie);

      expect(res.statusCode).toEqual(404);
    });

    test('Response_404_clientId(does_not_exist)', async () => {
      const res = await request(app)
        .get('/app/doesnotExistClient')
        .set('Cookie', currentUser.sidCookie);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST', () => {
    beforeEach(() => {
      prismaClient.oauth_client.deleteMany({
        where: {
          client_name: testClientData.newClient.client_name,
        },
      });
    });

    test('Response_Created_Client_With_200', async () => {
      const res = await request(app)
        .post('/app')
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .attach(
          'logo',
          fs.createReadStream('./tests/data/images/newClient.png')
        )
        .field('client_name', testClientData.newClient.client_name)
        .field('client_uri', testClientData.newClient.client_uri);

      expect(res.statusCode).toEqual(201);
      expect(res.body.client_name).toEqual(
        testClientData.newClient.client_name
      );
      expect(res.statusCode).toEqual(201);
    });

    test('Response_Created_Client_With_200_Logo(x)', async () => {
      const res = await request(app)
        .post('/app')
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .field('client_name', testClientData.newClient.client_name)
        .field('client_uri', testClientData.newClient.client_uri);

      expect(res.statusCode).toEqual(201);
      expect(res.body.client_name).toEqual(
        testClientData.newClient.client_name
      );
      expect(res.body.client_uri).toEqual(testClientData.newClient.client_uri);
    });

    test('Response_400_Name(x)', async () => {
      const res = await request(app)
        .post('/app')
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .attach(
          'logo',
          //must be relative path from where test running
          fs.createReadStream('./tests/data/images/newClient.png')
        )
        .field('client_uri', testClientData.newClient.client_uri);

      expect(res.statusCode).toEqual(400);
    });

    test('Response_400_Uri(x)', async () => {
      const res = await request(app)
        .post('/app')
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .attach(
          'logo',
          //must be relative path from where test running
          fs.createReadStream('./tests/data/images/newClient.png')
        )
        .field('client_name', testClientData.newClient.client_name);

      expect(res.statusCode).toEqual(400);
    });

    test('Response_400_Name(?)', async () => {
      const res = await request(app)
        .post('/app')
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .attach(
          'logo',
          fs.createReadStream('./tests/data/images/newClient.png')
        )
        // invalid client_name
        .field('name', testClientData.invalidateField.client_name)
        .field('uri', testClientData.newClient.client_uri);

      expect(res.statusCode).toEqual(400);
    });

    test('Response_400_Uri(?)', async () => {
      const res = await request(app)
        .post('/app')
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .attach(
          'logo',
          fs.createReadStream('./tests/data/images/newClient.png')
        )
        .field('name', testClientData.newClient.client_name)
        // invalid client_uri
        .field('uri', testClientData.invalidateField.client_uri);

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('PUT', () => {
    // test 종료 후
    afterAll(() => {
      // update된 정보를 되돌린다.
      prismaClient.oauth_client.update({
        where: {
          client_id: testClientData.clients[0].client_id,
        },
        data: testClientData.clients[0],
      });
    });

    const updatedName = 'updatedClient1';
    const updatedUri = 'http://www.updated.com';
    const updatedRedirectUri1 = 'https://wws.updated.com/callback';

    test('Response_Logo_Updated_Client_With_200', async () => {
      const res = await request(app)
        .put(`/app/${testClientData.clients[0].client_id}`)
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .field('client_name', updatedName)
        .field('client_uri', updatedUri)
        .field('logo_update_option', 'update')
        .field('redirect_uri1', updatedRedirectUri1)
        .attach(
          'logo',
          //must be relative path from where test running
          fs.createReadStream('./tests/data/images/newClient.png')
        );

      expect(res.statusCode).toEqual(200);
      expect(res.body.client_name).toEqual(updatedName);
      expect(res.body.client_uri).toEqual(updatedUri);
    });

    test('Response_Logo_Removed_Client_With_200', async () => {
      const res = await request(app)
        .put(`/app/${testClientData.clients[0].client_id}`)
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .field('client_name', updatedName)
        .field('client_uri', updatedUri)
        .field('logo_update_option', 'delete')
        .field('redirect_uri1', updatedRedirectUri1);

      expect(res.statusCode).toEqual(200);
      expect(res.body.client_name).toEqual(updatedName);
      expect(res.body.client_uri).toEqual(updatedUri);
      expect(res.body.logo_uri).toEqual(
        new URL('default.png', servingURL.client.logo).toString()
      );
    });

    test('Response_404_clientId(does_not_exist)', async () => {
      const res = await request(app)
        .put(`/app/doesnotExistClientId`)
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .field('client_name', updatedName)
        .field('client_uri', updatedUri)
        .field('logo_update_option', 'update')
        .field('redirect_uri1', updatedRedirectUri1)
        .attach(
          'logo',
          //must be relative path from where test running
          fs.createReadStream('./tests/data/images/newClient.png')
        );

      expect(res.statusCode).toEqual(404);
    });

    test('Response_404_clientId(not_authorized)', async () => {
      const res = await request(app)
        .put(`/app/${testClientData.clientsOfOtherUser[0].client_id}`)
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .field('client_name', updatedName)
        .field('client_uri', updatedUri)
        .field('logo_update_option', 'update')
        .field('redirect_uri1', updatedRedirectUri1)
        .attach(
          'logo',
          //must be relative path from where test running
          fs.createReadStream('./tests/data/images/newClient.png')
        );

      expect(res.statusCode).toEqual(404);
    });

    test('Response_Updated_Client_With_200_Logo(x)', async () => {
      const res = await request(app)
        .put(`/app/${testClientData.clients[0].client_id}`)
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .field('client_name', updatedName)
        .field('client_uri', updatedUri)
        .field('logo_update_option', 'no-change');

      expect(res.statusCode).toEqual(200);
      expect(res.body.client_name).toEqual(updatedName);
      expect(res.body.client_uri).toEqual(updatedUri);
    });

    test('Response_Updated_Client_With_200_RedirectUri(x)', async () => {
      const res = await request(app)
        .put(`/app/${testClientData.clients[0].client_id}`)
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .field('client_name', updatedName)
        .field('client_uri', updatedUri)
        .field('logo_update_option', 'update')
        .attach(
          'logo',
          //must be relative path from where test running
          fs.createReadStream('./tests/data/images/newClient.png')
        );

      expect(res.statusCode).toEqual(200);
      expect(res.body.client_name).toEqual(updatedName);
      expect(res.body.client_uri).toEqual(updatedUri);
    });

    test('Response_400_Name(x)_Uri(x)', async () => {
      const res = await request(app)
        .put(`/app/${testClientData.clients[0].client_id}`)
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .field('logo_update_option', 'update')
        // missed client_name, client_uri
        .attach(
          'logo',
          //must be relative path from where test running
          fs.createReadStream('./tests/data/images/newClient.png')
        );

      expect(res.statusCode).toEqual(400);
    });

    test('Response_400_LogoUpdateOption(x)', async () => {
      const res = await request(app)
        .put(`/app/${testClientData.clients[0].client_id}`)
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .field('name', updatedUri)
        .field('uri', testClientData.invalidateField.client_uri)
        .field('redirect_uri', testClientData.invalidateField.redirect_uri)
        .attach(
          'logo',
          fs.createReadStream('./tests/data/images/newClient.png')
        );

      expect(res.statusCode).toEqual(400);
    });

    test('Response_400_Name(?)', async () => {
      const res = await request(app)
        .put(`/app/${testClientData.clients[0].client_id}`)
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        //invlalid client_name
        .field('name', testClientData.invalidateField.client_name)
        .field('uri', updatedUri)
        .field('logo_update_option', 'update')
        .attach(
          'logo',
          fs.createReadStream('./tests/data/images/newClient.png')
        );

      expect(res.statusCode).toEqual(400);
    });

    test('Response_400_Uri(?)', async () => {
      const res = await request(app)
        .put(`/app/${testClientData.clients[0].client_id}`)
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .field('name', updatedUri)
        //invalid client_uri
        .field('uri', testClientData.invalidateField.client_uri)
        .field('logo_update_option', 'update')
        .attach(
          'logo',
          fs.createReadStream('./tests/data/images/newClient.png')
        );

      expect(res.statusCode).toEqual(400);
    });

    test('Response_400_RedirectUri(?)', async () => {
      const res = await request(app)
        .put(`/app/${testClientData.clients[0].client_id}`)
        .set('Cookie', currentUser.sidCookie)
        .set('Content-Type', 'multipart/form-data')
        .field('name', updatedUri)
        .field('uri', testClientData.invalidateField.client_uri)
        .field('redirect_uri', testClientData.invalidateField.redirect_uri)
        .field('logo_update_option', 'update')
        .attach(
          'logo',
          fs.createReadStream('./tests/data/images/newClient.png')
        );

      expect(res.statusCode).toEqual(400);
    });
  });

  describe('DELETE', () => {
    afterAll(async () => {
      await prismaClient.oauth_client.create({
        data: testClientData.clients[0],
      });
    });

    test('Response_204', async () => {
      const res = await request(app)
        .delete(`/app/${testClientData.clients[0].client_id}`)
        .set('Cookie', currentUser.sidCookie);

      expect(res.statusCode).toEqual(204);
    });

    test('Response_404_clientId(not_authorized)', async () => {
      const res = await request(app)
        .delete(`/app/${testClientData.clientsOfOtherUser[0].client_id}`)
        .set('Cookie', currentUser.sidCookie);

      expect(res.statusCode).toEqual(404);
    });

    test('Response_404_clientId(does_not_exist)', async () => {
      const res = await request(app)
        .delete(`/app/${testClientData.clients[0].client_id}`)
        .set('Cookie', currentUser.sidCookie);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('PATCH', () => {
    describe('ClientSecret', () => {
      test('Response_Updated_Client_With_200', async () => {
        const res = await request(app)
          .patch(`/app/${testClientData.clients[0].client_id}/secret`)
          .set('Cookie', currentUser.sidCookie);

        expect(res.statusCode).toEqual(200);
        expect(res.body).not.toBeUndefined();

        //update 된 client는 응답되어야하고, patch를 요청한 client secret을 제외하고는 모두 변경되지 않아야한다.
        expect(res.body).toMatchObject({
          ...testClientData.clients[0],
          //client_secret은 patch되어 같지 않다. string이라면 match 판정이다.
          client_secret: expect.any(String),
        });

        //client_secret은 patch되었어야한다.
        expect(res.body.client_secret).not.toEqual(
          testClientData.clients[0].client_secret
        );
      });

      test('Response_404_clientId(not_authorized)', async () => {
        const res = await request(app)
          .delete(
            `/app/${testClientData.clientsOfOtherUser[0].client_id}/secret`
          )
          .set('Cookie', currentUser.sidCookie);
        // 권한이 없는 client에 대해서는 forbidden이 아닌 존재 자체가 숨겨진다.
        expect(res.statusCode).toEqual(404);
      });

      test('Response_404_clientId(does_not_exist)', async () => {
        const res = await request(app)
          .patch(`/app/does_not_exist/secret`)
          .set('Cookie', currentUser.sidCookie);

        // 존재하지 않는 client
        expect(res.status).toEqual(404);
      });
    });

    describe('Scope', () => {
      beforeEach(async () => {
        prismaClient.oauth_client.update({
          where: {
            client_id: testClientData.clients[0].client_id,
          },
          data: {
            scope: '',
          },
        });
      });

      // 기존 client의 scope에 포함되어있지 않던 새로운 scope를 추가한다.
      test('Response_Partial_Updated_Client_With_200', async () => {
        const patchDocument = [
          { op: 'replace', path: '/', value: 'user:username.read.write' },
        ];

        const res = await request(app)
          .patch(`/app/${testClientData.clients[0].client_id}/scope`)
          .set('Cookie', currentUser.sidCookie)
          .set('Content-Type', 'application/json-patch+json')
          .send(patchDocument);

        expect(res.statusCode).toEqual(200);
      });

      // 기존 client의 scope에 포함되어있던 scope에 대해 다른 권한을 나타내는 scope를 add한다면 덮어씌워져야한다.
      test('Response_Partial_Updated_Client_With_200', async () => {
        const patchDocument = [
          {
            op: 'replace',
            path: '/',
            value: 'user:username.read.write user:pfp.read',
          },
        ];

        const res = await request(app)
          .patch(`/app/${testClientData.clients[0].client_id}/scope`)
          .set('Cookie', currentUser.sidCookie)
          .set('Content-Type', 'application/json-patch+json')
          .send(patchDocument);

        expect(res.statusCode).toEqual(200);
      });

      test('Response_400_PatchDocument(?(path(x)))', async () => {
        // invalid : path property missed
        const patchDocument = [{ op: 'replace', value: 'user:username.read' }];
        const res = await request(app)
          .patch(`/app/${testClientData.clients[0].client_id}/scope`)
          .set('Cookie', currentUser.sidCookie)
          .set('Content-Type', 'application/json-patch+json')
          .send(patchDocument);

        expect(res.statusCode).toEqual(400);
      });

      test('Response_400_PatchDocument(?(op(x)))', async () => {
        // invalid : op property missed
        const patchDocument = [{ path: '/', value: 'user:username.read' }];

        // path property missed
        const res = await request(app)
          .patch(`/app/${testClientData.clients[0].client_id}/scope`)
          .set('Cookie', currentUser.sidCookie)
          .set('Content-Type', 'application/json-patch+json')
          .send(patchDocument);

        expect(res.statusCode).toEqual(400);
      });

      test('Response_400_PatchDocument(?(value(x)))', async () => {
        // invalid : value property missed
        const patchDocument = [{ op: 'replace', path: '/' }];

        const res = await request(app)
          .patch(`/app/${testClientData.clients[0].client_id}/scope`)
          .set('Cookie', currentUser.sidCookie)
          .set('Content-Type', 'application/json-patch+json')
          .send(patchDocument);

        expect(res.statusCode).toEqual(400);
      });

      test('Response_400_PatchDocument(?(value(invalidFormat))', async () => {
        const patchDocument = [
          { op: 'replace', path: '/', value: 'user;username.read.write' },
        ];

        const res = await request(app)
          .patch(`/app/${testClientData.clients[0].client_id}/scope`)
          .set('Cookie', currentUser.sidCookie)
          .set('Content-Type', 'application/json-patch+json')
          .send(patchDocument);

        expect(res.statusCode).toEqual(400);
      });

      test('Response_400_PatchDocument(?(value(unReservedFormat))', async () => {
        const patchDocument = [
          { op: 'replace', path: '/', value: 'user:age.read.write' },
        ];

        const res = await request(app)
          .patch(`/app/${testClientData.clients[0].client_id}/scope`)
          .set('Cookie', currentUser.sidCookie)
          .set('Content-Type', 'application/json-patch+json')
          .send(patchDocument);

        expect(res.statusCode).toEqual(400);
      });
    });
  });
});
